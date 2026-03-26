import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme, FieldType } from '@grafana/data';
import { LegendDisplayMode } from '@grafana/schema';

import { PanelContextProvider } from '../PanelChrome/PanelContext';
import { SeriesVisibilityChangeMode } from '../PanelChrome/types';

import { PlotLegend } from './PlotLegend';
import { UPlotConfigBuilder } from './config/UPlotConfigBuilder';

const theme = createTheme();

function buildConfig(count: number): UPlotConfigBuilder {
  const config = new UPlotConfigBuilder();
  for (let i = 0; i < count; i++) {
    config.addSeries({
      dataFrameFieldIndex: { frameIndex: 0, fieldIndex: i + 1 },
      scaleKey: 'y',
      show: true,
      theme,
    });
  }
  return config;
}

const defaultProps: React.ComponentProps<typeof PlotLegend> = {
  data: [
    {
      length: 2,
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2], config: {} },
        { name: 'cpu', type: FieldType.number, values: [1, 2], config: {}, labels: { host: 'a' } },
        { name: 'mem', type: FieldType.number, values: [1, 2], config: {}, labels: { host: 'b' } },
      ],
    },
  ],
  config: buildConfig(2),
  placement: 'bottom',
  displayMode: LegendDisplayMode.List,
  calcs: [],
  showLegend: true,
  enableFacetedFilter: true,
};

function renderWithContext(overrides: Partial<React.ComponentProps<typeof PlotLegend>> = {}) {
  const toggle = jest.fn();
  return {
    toggle,
    ...render(
      <PanelContextProvider
        value={{ eventsScope: 'test', eventBus: { publish: jest.fn() } as never, onToggleSeriesVisibility: toggle }}
      >
        <PlotLegend {...defaultProps} {...overrides} />
      </PanelContextProvider>
    ),
  };
}

describe('PlotLegend faceted filter', () => {
  it('does not render filter when disabled', () => {
    renderWithContext({ enableFacetedFilter: false });
    expect(screen.queryByTestId('faceted-labels-filter-toggle')).not.toBeInTheDocument();
  });

  it('opens popover and calls onToggleSeriesVisibility on selection', async () => {
    const { toggle } = renderWithContext();
    await userEvent.click(screen.getByTestId('faceted-labels-filter-toggle'));

    const popover = screen.getByTestId('toggletip-content');
    expect(within(popover).getByText('By name')).toBeInTheDocument();

    await userEvent.click(within(popover).getByLabelText('cpu'));
    expect(toggle).toHaveBeenCalledWith(expect.any(Array), SeriesVisibilityChangeMode.SetExactly);
  });

  it('docks filter, shows clear all when active, and resets on clear', async () => {
    const { toggle } = renderWithContext();

    await userEvent.click(screen.getByTestId('faceted-labels-filter-toggle'));
    await userEvent.click(within(screen.getByTestId('toggletip-content')).getByText('Pin to sidebar'));
    expect(screen.getByLabelText('Unpin')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('cpu'));
    toggle.mockClear();

    await userEvent.click(screen.getByLabelText('Clear all'));
    expect(toggle).toHaveBeenCalledWith(null, SeriesVisibilityChangeMode.SetExactly);
  });
});
