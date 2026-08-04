import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataSourceInstanceSettings, type TimeRange, store } from '@grafana/data';
import { type DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

import { CONTENT_OUTLINE_LOCAL_STORAGE_KEYS, ContentOutline } from './ContentOutline';
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

const promSettings = {
  uid: 'prom-uid',
  type: 'prometheus',
  name: 'gdev-prometheus',
  meta: { id: 'prometheus', info: { logos: { small: 'prometheus.svg' } } },
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

const setup = (
  mergeSingleChild = false,
  showSignalExplorer = false,
  queries: DataQuery[] = [],
  includeQueriesItem = false
) => {
  HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

  scrollerMock.scroll = jest.fn();

  setDataSourceSrv({
    getInstanceSettings: () => promSettings,
  } as unknown as DataSourceSrv);

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

  return render(
    <ContentOutline
      scroller={scrollerMock}
      panelId="content-outline-container-1"
      showSignalExplorer={showSignalExplorer}
      queries={queries}
      timeRange={timeRange}
    />
  );
};

describe('<ContentOutline />', () => {
  beforeEach(() => {
    // The outline persists whether it is expanded, so a test that collapses it would otherwise
    // hand the collapsed state to every test that runs after it.
    store.delete(CONTENT_OUTLINE_LOCAL_STORAGE_KEYS.expanded);
  });

  it('toggles content on button click', async () => {
    setup();
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
    setup();
    const itemButtons = screen.getAllByRole('button', { name: /Item [0-9]+/ });

    for (const button of itemButtons) {
      await userEvent.click(button);
    }

    expect(scrollerMock.scroll).toHaveBeenCalledTimes(itemButtons.length);
  });

  it('doesnt merge a single child item when mergeSingleChild is false', async () => {
    setup();
    const expandSectionChevrons = screen.getAllByRole('button', { name: 'Content outline item collapse button' });
    await userEvent.click(expandSectionChevrons[0]);

    const child = screen.getByRole('button', { name: 'Item 1-1' });
    expect(child).toBeInTheDocument();
  });

  it('merges a single child item when mergeSingleChild is true', () => {
    setup(true);
    const child = screen.queryByRole('button', { name: 'Item 1-1' });

    expect(child).not.toBeInTheDocument();
  });

  it('displays multiple children', async () => {
    setup();
    const expandSectionChevrons = screen.getAllByRole('button', { name: 'Content outline item collapse button' });
    await userEvent.click(expandSectionChevrons[1]);

    const child1 = screen.getByRole('button', { name: 'Item 2-1' });
    const child2 = screen.getByRole('button', { name: 'Item 2-2' });
    expect(child1).toBeInTheDocument();
    expect(child2).toBeInTheDocument();
  });

  it('if item has multiple children, it displays multiple children even when mergeSingleChild is true', async () => {
    setup(true);
    const expandSectionChevrons = screen.getAllByRole('button', { name: 'Content outline item collapse button' });
    // since first item has only one child, we will have only one chevron
    await userEvent.click(expandSectionChevrons[0]);

    const child1 = screen.getByRole('button', { name: 'Item 2-1' });
    const child2 = screen.getByRole('button', { name: 'Item 2-2' });
    expect(child1).toBeInTheDocument();
    expect(child2).toBeInTheDocument();
  });

  it('collapse button has same aria-controls as the section content', async () => {
    setup();
    const expandSectionChevrons = screen.getAllByRole('button', { name: 'Content outline item collapse button' });
    // chevron for the second item
    const button = expandSectionChevrons[1];
    // content for the second item
    const sectionContent = screen.getByTestId('section-wrapper-item-2');
    await userEvent.click(button);
    expect(button.getAttribute('aria-controls')).toBe(sectionContent.id);
  });

  it('deletes item on delete button click', async () => {
    setup();
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
    setup();
    const collapseContentOutlineButton = screen.queryByRole('button', { name: 'Collapse outline' });
    const expandContentOutlineButton = screen.queryByRole('button', { name: 'Expand outline' });
    expect(collapseContentOutlineButton).not.toBeInTheDocument();
    expect(expandContentOutlineButton).toBeInTheDocument();

    getBoolMock.mockRestore();
  });

  describe('icon-only outline', () => {
    it('renders every section open, with no collapse toggle left behind', async () => {
      setup();
      await userEvent.click(screen.getByRole('button', { name: 'Collapse outline' }));

      expect(screen.queryAllByRole('button', { name: 'Content outline item collapse button' })).toHaveLength(0);
      expect(screen.getByRole('button', { name: 'Item 1-1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Item 2-1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Item 2-2' })).toBeInTheDocument();
    });

    it('lets the children stand for a section instead of repeating its icon', async () => {
      setup();
      await userEvent.click(screen.getByRole('button', { name: 'Collapse outline' }));

      expect(screen.queryByRole('button', { name: 'Item 1' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Item 2' })).not.toBeInTheDocument();
    });

    it('keeps the section row when its children are not rendered', async () => {
      // A merged single child is folded into its section, which then has nothing to stand for it.
      setup(true);
      await userEvent.click(screen.getByRole('button', { name: 'Collapse outline' }));

      expect(screen.getByRole('button', { name: 'Item 1' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Item 1-1' })).not.toBeInTheDocument();
    });

    it('restores each section to the state it had before the outline was collapsed', async () => {
      setup();
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

    it('hides the header title and the query cards by default (feature toggle off)', () => {
      setup(false, false, promQueries);
      expect(screen.queryByText('Outline')).not.toBeInTheDocument();
      expect(screen.queryByText('Datasource explorer')).not.toBeInTheDocument();
      expect(screen.queryByTestId('signal-card-A')).not.toBeInTheDocument();
    });

    it('does not render the query cards or header title when the feature toggle is disabled', () => {
      useBooleanFlagValueMock.mockReturnValue(false);
      setup(false, true, promQueries);
      expect(screen.queryByTestId('signal-card-A')).not.toBeInTheDocument();
      expect(screen.queryByText('Outline')).not.toBeInTheDocument();
    });

    it('renders a query card and the "Datasource explorer" title when the toggle is enabled and Prometheus is selected', () => {
      useBooleanFlagValueMock.mockReturnValue(true);
      setup(false, true, promQueries);
      expect(screen.getByText('Datasource explorer')).toBeInTheDocument();
      expect(screen.getByTestId('signal-card-A')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Jump to query A (gdev-prometheus)' })).toBeInTheDocument();
    });

    it('renders the metrics explorer once a Prometheus card is expanded', async () => {
      useBooleanFlagValueMock.mockReturnValue(true);
      setup(false, true, promQueries);
      expect(screen.queryByPlaceholderText('Search metrics')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Expand datasource explorer for query A' }));

      // Only that the list mounted: its contents come from the datasource now, which this test does
      // not stand up. `MetricsList.test.tsx` covers what the list does with a catalog.
      expect(screen.getByPlaceholderText('Search metrics')).toBeInTheDocument();
    });

    it('hides the explorer when the outline is collapsed', async () => {
      useBooleanFlagValueMock.mockReturnValue(true);
      setup(false, true, promQueries);
      expect(screen.getByTestId('signal-card-A')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Collapse outline' }));

      expect(screen.queryByText('Datasource explorer')).not.toBeInTheDocument();
      expect(screen.queryByTestId('signal-card-A')).not.toBeInTheDocument();
      // The collapsed rail keeps its own copy of the toggle, so the explorer going away
      // must not take the way back with it.
      expect(screen.getByRole('button', { name: 'Expand outline' })).toBeInTheDocument();
    });

    it('drops the outline Queries section while the explorer is visible', () => {
      useBooleanFlagValueMock.mockReturnValue(true);
      setup(false, true, promQueries, true);

      expect(screen.getByTestId('signal-card-A')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Queries' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'A' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Item 1' })).toBeInTheDocument();
    });

    it('keeps the outline Queries section when the explorer is not visible', () => {
      setup(false, false, promQueries, true);

      expect(screen.getByRole('button', { name: 'Queries' })).toBeInTheDocument();
    });

    it('renders the query rows as icons once the outline is collapsed in metrics mode', async () => {
      useBooleanFlagValueMock.mockReturnValue(true);
      setup(false, true, promQueries, true);

      await userEvent.click(screen.getByRole('button', { name: 'Collapse outline' }));

      // The explorer is gone with the outline collapsed, so the query rows are only reachable
      // through the outline again — as the rows themselves, not behind a Queries section.
      expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'B' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Queries' })).not.toBeInTheDocument();
    });

    it('does not render the query cards or header title when the toggle is enabled but Prometheus is not selected', () => {
      useBooleanFlagValueMock.mockReturnValue(true);
      setup(false, false, promQueries);
      expect(screen.queryByTestId('signal-card-A')).not.toBeInTheDocument();
      expect(screen.queryByText('Datasource explorer')).not.toBeInTheDocument();
      expect(screen.queryByText('Outline')).not.toBeInTheDocument();
    });
  });
});
