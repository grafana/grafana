import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataSourceInstanceSettings, type DataSourcePluginMeta, type TimeRange, store } from '@grafana/data';
import { initDataSourceInstanceSettings, setDatasourcePluginMetas } from '@grafana/runtime/internal';
import { type DataQuery } from '@grafana/schema';

import { CONTENT_OUTLINE_LOCAL_STORAGE_KEYS, ContentOutline, shouldBeActive } from './ContentOutline';
import { type ContentOutlineItemContextProps } from './ContentOutlineContext';
import { QUERIES_PANEL_ID } from './ContentOutlineItem';

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

/** Mirrors how Explore registers the query rows: one root item, one child per query row. */
const queriesOutlineItem = () => ({
  id: 'queries',
  panelId: QUERIES_PANEL_ID,
  icon: 'test-icon',
  title: 'Queries',
  level: 'root',
  ref: document.createElement('div'),
  mergeSingleChild: true,
  children: ['A', 'B'].map((refId) => ({
    id: `queries-${refId}`,
    panelId: QUERIES_PANEL_ID,
    icon: 'test-icon',
    title: refId,
    level: 'child',
    ref: document.createElement('div'),
  })),
});

const setup = async (
  mergeSingleChild = false,
  showSignalExplorer = false,
  queries: DataQuery[] = [],
  includeQueriesItem = false
) => {
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
      ...(includeQueriesItem ? [queriesOutlineItem()] : []),
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
  beforeEach(() => {
    // The outline persists whether it is expanded, so a test that collapses it would otherwise
    // hand the collapsed state to every test that runs after it.
    store.delete(CONTENT_OUTLINE_LOCAL_STORAGE_KEYS.expanded);
  });

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

  it('tracks the scroll container Explore hands over after the first render', () => {
    const mockUseContentOutlineContext = require('./ContentOutlineContext').useContentOutlineContext;
    mockUseContentOutlineContext.mockReturnValue({ outlineItems: [], register: jest.fn(), unregister: jest.fn() });

    const scroller = document.createElement('div');
    const addScrollListener = jest.spyOn(scroller, 'addEventListener');

    // Explore assigns its scroll container in a ref callback, so the outline's first render gets
    // nothing. Without tracking it, the active item never moves off the one it started on.
    const { rerender } = render(
      <ContentOutline scroller={undefined} panelId="content-outline-container-1" timeRange={timeRange} />
    );
    expect(addScrollListener).not.toHaveBeenCalled();

    rerender(<ContentOutline scroller={scroller} panelId="content-outline-container-1" timeRange={timeRange} />);

    expect(addScrollListener).toHaveBeenCalledWith('scroll', expect.any(Function), expect.anything());
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

  describe('icon-only outline', () => {
    it('renders every section open, with no collapse toggle left behind', async () => {
      await setup();
      await userEvent.click(screen.getByRole('button', { name: 'Collapse outline' }));

      expect(screen.queryAllByRole('button', { name: 'Content outline item collapse button' })).toHaveLength(0);
      expect(screen.getByRole('button', { name: 'Item 1-1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Item 2-1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Item 2-2' })).toBeInTheDocument();
    });

    it('lets the children stand for a section instead of repeating its icon', async () => {
      await setup();
      await userEvent.click(screen.getByRole('button', { name: 'Collapse outline' }));

      expect(screen.queryByRole('button', { name: 'Item 1' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Item 2' })).not.toBeInTheDocument();
    });

    it('keeps the section row when its children are not rendered', async () => {
      // A merged single child is folded into its section, which then has nothing to stand for it.
      await setup(true);
      await userEvent.click(screen.getByRole('button', { name: 'Collapse outline' }));

      expect(screen.getByRole('button', { name: 'Item 1' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Item 1-1' })).not.toBeInTheDocument();
    });

    it('keeps the section row when a child does not lead back into it', async () => {
      // Explore registers a pinned log line as a child of Logs with no ref, because clicking it
      // opens the log context instead of scrolling. Letting it stand for the section would leave
      // the rail with nothing that jumps to Logs.
      const mockUseContentOutlineContext = require('./ContentOutlineContext').useContentOutlineContext;
      mockUseContentOutlineContext.mockReturnValue({
        outlineItems: [
          {
            id: 'logs',
            panelId: 'Logs',
            icon: 'gf-logs',
            title: 'Logs',
            level: 'root',
            ref: document.createElement('div'),
            children: [
              {
                id: 'pinned-log',
                panelId: 'Logs',
                icon: 'gf-logs',
                title: 'Pinned log',
                level: 'child',
                ref: null,
                childOnTop: true,
                onClick: jest.fn(),
              },
            ],
          },
        ],
        register: jest.fn(),
        unregister: unregisterMock,
      });

      render(<ContentOutline scroller={scrollerMock} panelId="content-outline-container-1" timeRange={timeRange} />);
      await userEvent.click(screen.getByRole('button', { name: 'Collapse outline' }));

      expect(screen.getByRole('button', { name: 'Logs' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pinned log' })).toBeInTheDocument();
    });

    it('restores each section to the state it had before the outline was collapsed', async () => {
      await setup();
      // Open the first section only, so the two sections differ when the outline widens again.
      const chevrons = screen.getAllByRole('button', { name: 'Content outline item collapse button' });
      await userEvent.click(chevrons[0]);

      await userEvent.click(screen.getByRole('button', { name: 'Collapse outline' }));
      await userEvent.click(screen.getByRole('button', { name: 'Expand outline' }));

      expect(screen.getByRole('button', { name: 'Item 1-1' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Item 2-1' })).not.toBeInTheDocument();
    });
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

    it('drops the outline Queries section while the explorer is visible', async () => {
      useBooleanFlagValueMock.mockReturnValue(true);
      await setup(false, true, promQueries, true);

      expect(screen.getByTestId('signal-card-A')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Queries' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'A' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Item 1' })).toBeInTheDocument();
    });

    it('keeps the outline Queries section when the explorer is not visible', async () => {
      await setup(false, false, promQueries, true);

      expect(screen.getByRole('button', { name: 'Queries' })).toBeInTheDocument();
    });

    it('renders the query rows as icons once the outline is collapsed in metrics mode', async () => {
      useBooleanFlagValueMock.mockReturnValue(true);
      await setup(false, true, promQueries, true);

      await userEvent.click(screen.getByRole('button', { name: 'Collapse outline' }));

      // The explorer is gone with the outline collapsed, so the query rows are only reachable
      // through the outline again — as the rows themselves, not behind a Queries section.
      expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'B' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Queries' })).not.toBeInTheDocument();
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

// The highlight is styling, so it cannot be read off the rendered rows. These cover the rule the
// rows are given instead: a section takes the highlight only while it stands in for its children.
describe('shouldBeActive', () => {
  const child = (id: string, title: string, ref: HTMLElement | null = document.createElement('div')) =>
    ({ id, title, level: 'child', ref }) as ContentOutlineItemContextProps;
  const queryRow = child('query-1', 'A');
  const secondQueryRow = child('query-2', 'B');
  const section = (children: ContentOutlineItemContextProps[], mergeSingleChild = false) =>
    ({ id: 'queries', title: 'Queries', mergeSingleChild, children }) as ContentOutlineItemContextProps;

  it('highlights a section that is merged into its single child', () => {
    // The child never gets a row of its own, so the section is all the user has to go on.
    expect(shouldBeActive(section([queryRow], true), 'queries', undefined, false)).toBe(true);
  });

  it('highlights a collapsed section on behalf of its active child', () => {
    expect(shouldBeActive(section([queryRow, secondQueryRow]), 'queries', 'query-1', false)).toBe(true);
  });

  it('leaves the highlight to the children once they are on screen', () => {
    expect(shouldBeActive(section([queryRow, secondQueryRow]), 'queries', 'query-1', true)).toBe(false);
  });

  it('highlights a row that has no children of its own', () => {
    expect(shouldBeActive(queryRow, 'queries', 'query-1', false)).toBe(true);
  });

  it('keeps the highlight on a section whose children cannot take it', () => {
    // A pinned log line has no ref, so the scroll spy can never land on it and the section has to
    // hold the highlight even with the pin on screen.
    expect(shouldBeActive(section([child('pinned-log', 'Pinned log', null)]), 'queries', undefined, true)).toBe(true);
  });
});
