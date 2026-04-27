import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EventBusSrv } from '@grafana/data/events';
import { LegendDisplayMode } from '@grafana/schema';

import { PanelContextProvider, SeriesVisibilityChangeMode } from '../PanelChrome';

import { VizLegend } from './VizLegend';
import { SeriesVisibilityChangeBehavior, type VizLegendItem } from './types';

function makeItem(label: string, overrides: Partial<VizLegendItem> = {}): VizLegendItem {
  return { label, color: 'red', yAxis: 1, ...overrides };
}

function renderWithContext(ui: React.ReactElement, contextOverrides: Record<string, unknown> = {}) {
  const eventBus = new EventBusSrv();
  const context = { eventsScope: 'global' as const, eventBus, ...contextOverrides };
  return { ...render(<PanelContextProvider value={context}>{ui}</PanelContextProvider>), eventBus };
}

const legendButton = () => screen.getByRole('button', { name: /all series selected/i });

describe('VizLegend', () => {
  describe('display modes', () => {
    it('renders null for Hidden mode', () => {
      const { container } = renderWithContext(
        <VizLegend displayMode={LegendDisplayMode.Hidden} items={[makeItem('A')]} placement="bottom" />
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('renders list items for List mode', () => {
      renderWithContext(
        <VizLegend displayMode={LegendDisplayMode.List} items={[makeItem('A'), makeItem('B')]} placement="bottom" />
      );
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('renders a table for Table mode', () => {
      renderWithContext(
        <VizLegend
          displayMode={LegendDisplayMode.Table}
          items={[makeItem('A', { getDisplayValues: () => [{ numeric: 10, text: '10', title: 'min' }] })]}
          placement="bottom"
          isSortable
        />
      );
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  describe('list mode - threshold and mapping items', () => {
    const thresholds = [makeItem('Low', { color: 'green' }), makeItem('High', { color: 'red' })];
    const mappings = [makeItem('Mapped A', { color: 'blue' })];

    it('renders threshold items instead of regular items when thresholds > 1', () => {
      renderWithContext(
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={[makeItem('Regular')]}
          thresholdItems={thresholds}
          placement="bottom"
        />
      );
      expect(screen.queryByText('Regular')).not.toBeInTheDocument();
      expect(screen.getByText('Low')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
    });

    it('ignores thresholds when only one threshold item exists', () => {
      renderWithContext(
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={[makeItem('Regular')]}
          thresholdItems={[makeItem('Only')]}
          placement="bottom"
        />
      );
      expect(screen.getByText('Regular')).toBeInTheDocument();
      expect(screen.queryByText('Only')).not.toBeInTheDocument();
    });

    it('renders mapping items alongside regular items based on series count', () => {
      const { unmount } = renderWithContext(
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={[makeItem('Solo')]}
          mappingItems={mappings}
          placement="bottom"
        />
      );
      expect(screen.getByText('Mapped A')).toBeInTheDocument();
      unmount();

      renderWithContext(
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={[makeItem('S1'), makeItem('S2')]}
          mappingItems={mappings}
          placement="bottom"
        />
      );
      expect(screen.getByText('S1')).toBeInTheDocument();
      expect(screen.getByText('S2')).toBeInTheDocument();
      expect(screen.getByText('Mapped A')).toBeInTheDocument();
    });
  });

  describe('series visibility', () => {
    it('uses ToggleSelection on plain click, AppendToSelection with ctrl (Isolate behavior)', async () => {
      const user = userEvent.setup();
      const onToggleSeriesVisibility = jest.fn();
      renderWithContext(<VizLegend displayMode={LegendDisplayMode.List} items={[makeItem('A')]} placement="bottom" />, {
        onToggleSeriesVisibility,
      });

      await user.click(legendButton());
      expect(onToggleSeriesVisibility).toHaveBeenCalledWith('A', SeriesVisibilityChangeMode.ToggleSelection);

      onToggleSeriesVisibility.mockClear();
      await user.keyboard('{Control>}');
      await user.click(legendButton());
      await user.keyboard('{/Control}');
      expect(onToggleSeriesVisibility).toHaveBeenCalledWith('A', SeriesVisibilityChangeMode.AppendToSelection);
    });

    it('always uses AppendToSelection for Hide behavior', async () => {
      const onToggleSeriesVisibility = jest.fn();
      renderWithContext(
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={[makeItem('A')]}
          placement="bottom"
          seriesVisibilityChangeBehavior={SeriesVisibilityChangeBehavior.Hide}
        />,
        { onToggleSeriesVisibility }
      );
      await userEvent.click(legendButton());
      expect(onToggleSeriesVisibility).toHaveBeenCalledWith('A', SeriesVisibilityChangeMode.AppendToSelection);
    });

    it('prefers fieldName over label for visibility toggle', async () => {
      const onToggleSeriesVisibility = jest.fn();
      renderWithContext(
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={[makeItem('Label', { fieldName: 'field' })]}
          placement="bottom"
        />,
        { onToggleSeriesVisibility }
      );
      await userEvent.click(legendButton());
      expect(onToggleSeriesVisibility).toHaveBeenCalledWith('field', expect.any(String));
    });

    it('calls both onLabelClick and onToggleSeriesVisibility', async () => {
      const onLabelClick = jest.fn();
      const onToggleSeriesVisibility = jest.fn();
      renderWithContext(
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={[makeItem('A')]}
          placement="bottom"
          onLabelClick={onLabelClick}
        />,
        { onToggleSeriesVisibility }
      );
      await userEvent.click(legendButton());
      expect(onLabelClick).toHaveBeenCalledTimes(1);
      expect(onToggleSeriesVisibility).toHaveBeenCalledTimes(1);
    });
  });

  describe('hover events', () => {
    it('publishes DataHoverEvent and DataHoverClearEvent via eventBus', async () => {
      const { eventBus } = renderWithContext(
        <VizLegend displayMode={LegendDisplayMode.List} items={[makeItem('A')]} placement="bottom" />
      );
      const publishSpy = jest.spyOn(eventBus, 'publish');

      const button = legendButton();
      await userEvent.hover(button);
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'data-hover', payload: expect.objectContaining({ dataId: 'A' }) })
      );

      await userEvent.unhover(button);
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'data-hover-clear', payload: expect.objectContaining({ dataId: 'A' }) })
      );
    });
  });

  describe('table mode sorting', () => {
    const tableItem = makeItem('A', { getDisplayValues: () => [{ numeric: 1, text: '1', title: 'min' }] });

    it('calls onToggleSort prop when provided', async () => {
      const onToggleSort = jest.fn();
      renderWithContext(
        <VizLegend
          displayMode={LegendDisplayMode.Table}
          items={[tableItem]}
          placement="bottom"
          onToggleSort={onToggleSort}
          isSortable
        />
      );
      await userEvent.click(screen.getByText('min'));
      expect(onToggleSort).toHaveBeenCalledWith('min');
    });

    it('calls onToggleLegendSort from context when onToggleSort prop is not provided', async () => {
      const onToggleLegendSort = jest.fn();
      renderWithContext(
        <VizLegend displayMode={LegendDisplayMode.Table} items={[tableItem]} placement="bottom" isSortable />,
        { onToggleLegendSort }
      );
      await userEvent.click(screen.getByText('min'));
      expect(onToggleLegendSort).toHaveBeenCalledWith('min');
    });
  });
});
