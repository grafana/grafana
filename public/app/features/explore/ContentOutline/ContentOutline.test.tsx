import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataSourceInstanceSettings, type DataSourcePluginMeta, type TimeRange, store } from '@grafana/data';
import { initDataSourceInstanceSettings, setDatasourcePluginMetas } from '@grafana/runtime/internal';
import { type DataQuery } from '@grafana/schema';

import { ContentOutline } from './ContentOutline';

jest.mock('./ContentOutlineContext', () => ({
  useContentOutlineContext: jest.fn(),
}));

const useBooleanFlagValueMock = jest.fn((_: string, defaultValue: boolean) => defaultValue);

jest.mock('@openfeature/react-sdk', () => ({
  useBooleanFlagValue: (flag: string, defaultValue: boolean) => useBooleanFlagValueMock(flag, defaultValue),
}));

const scrollIntoViewMock = jest.fn();
const scrollerMock = document.createElement('div');

const unregisterMock = jest.fn();

const promMeta = { id: 'prometheus', info: { logos: { small: 'prometheus.svg' } } } as unknown as DataSourcePluginMeta;

const promSettings = {
  uid: 'prom-uid',
  type: 'prometheus',
  name: 'gdev-prometheus',
  meta: promMeta,
} as unknown as DataSourceInstanceSettings;

const timeRange = { raw: { from: 'now-1h', to: 'now' }, from: {}, to: {} } as unknown as TimeRange;

const setup = async (mergeSingleChild = false, showSignalExplorer = false, queries: DataQuery[] = []) => {
  HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

  scrollerMock.scroll = jest.fn();

  // SignalExplorer resolves a card's datasource and logo through the async datasource APIs, so
  // both of the caches behind them are seeded rather than the legacy `DataSourceSrv`.
  initDataSourceInstanceSettings({ 'gdev-prometheus': promSettings }, 'gdev-prometheus');
  setDatasourcePluginMetas({ prometheus: promMeta });

  // Mock useContentOutlineContext with custom outlineItems
  const mockUseContentOutlineContext = require('./ContentOutlineContext').useContentOutlineContext;

  mockUseContentOutlineContext.mockReturnValue({
    outlineItems: [
      {
        id: 'item-1',
        icon: 'test-icon',
        title: 'Item 1',
        ref: document.createElement('div'),
        mergeSingleChild,
        children: [
          {
            id: 'item-1-1',
            icon: 'test-icon',
            title: 'Item 1-1',
            ref: document.createElement('div'),
            level: 'child',
          },
        ],
      },
      {
        id: 'item-2',
        icon: 'test-icon',
        title: 'Item 2',
        ref: document.createElement('div'),
        mergeSingleChild,
        children: [
          {
            id: 'item-2-1',
            icon: 'test-icon',
            title: 'Item 2-1',
            ref: document.createElement('div'),
            level: 'child',
            onRemove: () => unregisterMock('item-2-1'),
          },
          {
            id: 'item-2-2',
            icon: 'test-icon',
            title: 'Item 2-2',
            ref: document.createElement('div'),
            level: 'child',
          },
        ],
      },
    ],
    register: jest.fn(),
    unregister: unregisterMock,
  });

  const rendered = render(
    <ContentOutline
      scroller={scrollerMock}
      panelId="content-outline-container-1"
      showSignalExplorer={showSignalExplorer}
      queries={queries}
      timeRange={timeRange}
    />
  );

  // The explorer's datasource hooks resolve a few promise turns after the first paint, so settle
  // them here: their state updates stay inside act() and the cards carry resolved names.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  return rendered;
};

describe('<ContentOutline />', () => {
  it('toggles content on button click', async () => {
    await setup();
    let showContentOutlineButton = screen.getByRole('button', { name: 'Collapse outline' });
    expect(showContentOutlineButton).toBeInTheDocument();

    await userEvent.click(showContentOutlineButton);
    const hideContentOutlineButton = screen.getByRole('button', { name: 'Expand outline' });
    expect(hideContentOutlineButton).toBeInTheDocument();

    await userEvent.click(hideContentOutlineButton);
    showContentOutlineButton = screen.getByRole('button', { name: 'Collapse outline' });
    expect(showContentOutlineButton).toBeInTheDocument();
  });

  it('scrolls into view on content button click', async () => {
    await setup();
    const itemButtons = screen.getAllByRole('button', { name: /Item [0-9]+/ });

    for (const button of itemButtons) {
      await userEvent.click(button);
    }

    expect(scrollerMock.scroll).toHaveBeenCalledTimes(itemButtons.length);
  });

  it('doesnt merge a single child item when mergeSingleChild is false', async () => {
    await setup();
    const expandSectionChevrons = screen.getAllByRole('button', { name: 'Content outline item collapse button' });
    await userEvent.click(expandSectionChevrons[0]);

    const child = screen.getByRole('button', { name: 'Item 1-1' });
    expect(child).toBeInTheDocument();
  });

  it('merges a single child item when mergeSingleChild is true', async () => {
    await setup(true);
    const child = screen.queryByRole('button', { name: 'Item 1-1' });

    expect(child).not.toBeInTheDocument();
  });

  it('displays multiple children', async () => {
    await setup();
    const expandSectionChevrons = screen.getAllByRole('button', { name: 'Content outline item collapse button' });
    await userEvent.click(expandSectionChevrons[1]);

    const child1 = screen.getByRole('button', { name: 'Item 2-1' });
    const child2 = screen.getByRole('button', { name: 'Item 2-2' });
    expect(child1).toBeInTheDocument();
    expect(child2).toBeInTheDocument();
  });

  it('if item has multiple children, it displays multiple children even when mergeSingleChild is true', async () => {
    await setup(true);
    const expandSectionChevrons = screen.getAllByRole('button', { name: 'Content outline item collapse button' });
    // since first item has only one child, we will have only one chevron
    await userEvent.click(expandSectionChevrons[0]);

    const child1 = screen.getByRole('button', { name: 'Item 2-1' });
    const child2 = screen.getByRole('button', { name: 'Item 2-2' });
    expect(child1).toBeInTheDocument();
    expect(child2).toBeInTheDocument();
  });

  it('collapse button has same aria-controls as the section content', async () => {
    await setup();
    const expandSectionChevrons = screen.getAllByRole('button', { name: 'Content outline item collapse button' });
    // chevron for the second item
    const button = expandSectionChevrons[1];
    // content for the second item
    const sectionContent = screen.getByTestId('section-wrapper-item-2');
    await userEvent.click(button);
    expect(button.getAttribute('aria-controls')).toBe(sectionContent.id);
  });

  it('deletes item on delete button click', async () => {
    await setup();
    const expandSectionChevrons = screen.getAllByRole('button', { name: 'Content outline item collapse button' });
    // chevron for the second item
    const button = expandSectionChevrons[1];
    await userEvent.click(button);
    const deleteButtons = screen.getAllByTestId('content-outline-item-delete-button');
    await userEvent.click(deleteButtons[0]);

    expect(unregisterMock).toHaveBeenCalledWith('item-2-1');
  });

  it('should retrieve the last expanded state from local storage', async () => {
    const getBoolMock = jest.spyOn(store, 'getBool').mockReturnValue(false);
    await setup();
    const collapseContentOutlineButton = screen.queryByRole('button', { name: 'Collapse outline' });
    const expandContentOutlineButton = screen.queryByRole('button', { name: 'Expand outline' });
    expect(collapseContentOutlineButton).not.toBeInTheDocument();
    expect(expandContentOutlineButton).toBeInTheDocument();

    getBoolMock.mockRestore();
  });

  describe('signal explorer', () => {
    const promQueries: DataQuery[] = [{ refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } }];

    afterEach(() => {
      useBooleanFlagValueMock.mockImplementation((_: string, defaultValue: boolean) => defaultValue);
    });

    it('hides the header title and the query cards by default (feature toggle off)', async () => {
      await setup(false, false, promQueries);
      expect(screen.queryByText('Outline')).not.toBeInTheDocument();
      expect(screen.queryByText('Datasource explorer')).not.toBeInTheDocument();
      expect(screen.queryByTestId('signal-card-A')).not.toBeInTheDocument();
    });

    it('does not render the query cards or header title when the feature toggle is disabled', async () => {
      useBooleanFlagValueMock.mockReturnValue(false);
      await setup(false, true, promQueries);
      expect(screen.queryByTestId('signal-card-A')).not.toBeInTheDocument();
      expect(screen.queryByText('Outline')).not.toBeInTheDocument();
    });

    it('renders a query card and the "Datasource explorer" title when the toggle is enabled and Prometheus is selected', async () => {
      useBooleanFlagValueMock.mockReturnValue(true);
      await setup(false, true, promQueries);
      expect(screen.getByText('Datasource explorer')).toBeInTheDocument();
      expect(screen.getByTestId('signal-card-A')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Jump to query A (gdev-prometheus)' })).toBeInTheDocument();
    });

    it('renders the metrics explorer once a Prometheus card is expanded', async () => {
      useBooleanFlagValueMock.mockReturnValue(true);
      await setup(false, true, promQueries);
      expect(screen.queryByPlaceholderText('Search metrics')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Expand datasource explorer for query A' }));

      // Only that the list mounted: its contents come from the datasource now, which this test does
      // not stand up. `MetricsList.test.tsx` covers what the list does with a catalog.
      expect(screen.getByPlaceholderText('Search metrics')).toBeInTheDocument();
    });

    it('hides the explorer when the outline is collapsed', async () => {
      useBooleanFlagValueMock.mockReturnValue(true);
      await setup(false, true, promQueries);
      expect(screen.getByTestId('signal-card-A')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Collapse outline' }));

      expect(screen.queryByText('Datasource explorer')).not.toBeInTheDocument();
      expect(screen.queryByTestId('signal-card-A')).not.toBeInTheDocument();
      // The collapsed rail keeps its own copy of the toggle, so the explorer going away
      // must not take the way back with it.
      expect(screen.getByRole('button', { name: 'Expand outline' })).toBeInTheDocument();
    });

    it('does not render the query cards or header title when the toggle is enabled but Prometheus is not selected', async () => {
      useBooleanFlagValueMock.mockReturnValue(true);
      await setup(false, false, promQueries);
      expect(screen.queryByTestId('signal-card-A')).not.toBeInTheDocument();
      expect(screen.queryByText('Datasource explorer')).not.toBeInTheDocument();
      expect(screen.queryByText('Outline')).not.toBeInTheDocument();
    });
  });
});
