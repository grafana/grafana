import { act, type ComponentProps, useEffect, useState } from 'react';
import type AutoSizer from 'react-virtualized-auto-sizer';
import { render as testRender, screen, waitFor } from 'test/test-utils';

import { store } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { EMPTY_TABLE_RESPONSE, type ListMeta, type TableResponse } from 'app/features/apiserver/types';
import { type SearchState, SearchLayout } from 'app/features/search/types';

import { deletedDashboardsCache } from '../search/service/deletedDashboardsCache';

import RecentlyDeletedPage from './RecentlyDeletedPage';
import { useRecentlyDeletedStateManager, type TrashStateManager } from './api/useRecentlyDeletedStateManager';
import { DISMISS_STORAGE_KEY } from './components/DeletedDashboardsLimitBanner';

setBackendSrv(backendSrv);
setupMockServer();

jest.mock('./api/useRecentlyDeletedStateManager');
jest.mock('../search/service/deletedDashboardsCache', () => ({
  deletedDashboardsCache: {
    getAsTable: jest.fn(),
  },
}));

jest.mock('react-virtualized-auto-sizer', () => ({
  __esModule: true,
  default(props: ComponentProps<typeof AutoSizer>) {
    return <div>{props.children({ width: 800, height: 600, scaledWidth: 800, scaledHeight: 600 })}</div>;
  },
}));

const mockUseRecentlyDeletedStateManager = useRecentlyDeletedStateManager as jest.MockedFunction<
  typeof useRecentlyDeletedStateManager
>;
const mockGetAsTable = deletedDashboardsCache.getAsTable as jest.MockedFunction<
  typeof deletedDashboardsCache.getAsTable
>;

function buildTable(count: number, metadata: Partial<ListMeta> = {}): TableResponse {
  return {
    ...EMPTY_TABLE_RESPONSE,
    metadata: { resourceVersion: '0', ...metadata },
    rows: Array.from({ length: count }, (_, i) => ({
      cells: [],
      object: {
        metadata: { name: `d-${i}`, resourceVersion: '0', creationTimestamp: '2024-01-01T00:00:00Z' },
      },
    })),
  };
}

function buildSearchResult(seed: number) {
  return { totalRows: 0, __seed: seed } as unknown as NonNullable<SearchState['result']>;
}

function defaultSearchState(result?: SearchState['result']): SearchState {
  return {
    query: '',
    tag: [],
    starred: false,
    layout: SearchLayout.List,
    deleted: true,
    eventTrackingNamespace: 'manage_dashboards',
    result,
  };
}

// Reactive mock state so we can simulate `stateManager.useState` emitting new
// values (the real hook subscribes to a BehaviorSubject; a static jest.fn()
// mock plus React.memo on the page would otherwise swallow re-renders).
let currentSearchState: SearchState = defaultSearchState();
const stateSubscribers = new Set<() => void>();

function publishSearchState(next: SearchState) {
  currentSearchState = next;
  stateSubscribers.forEach((notify) => notify());
}

const mockStateManager = {
  initStateFromUrl: jest.fn(),
  onQueryChange: jest.fn(),
  onLayoutChange: jest.fn(),
  onSortChange: jest.fn(),
  onTagFilterChange: jest.fn(),
  onDatasourceChange: jest.fn(),
  onPanelTypeChange: jest.fn(),
  onSetIncludePanels: jest.fn(),
  getTagOptions: jest.fn().mockResolvedValue([]),
  getSortOptions: jest.fn().mockResolvedValue([]),
} as unknown as TrashStateManager;

function render() {
  return testRender(<RecentlyDeletedPage />, {
    preloadedState: {
      navIndex: {
        'dashboards/recently-deleted': {
          id: 'dashboards/recently-deleted',
          text: 'Recently deleted',
        },
      },
    },
  });
}

const atLimitAlert = { name: /deleted dashboards limit reached/i };

describe('RecentlyDeletedPage banner integration', () => {
  beforeEach(() => {
    store.delete(DISMISS_STORAGE_KEY);
    mockGetAsTable.mockReset();
    currentSearchState = defaultSearchState();
    stateSubscribers.clear();

    mockUseRecentlyDeletedStateManager.mockImplementation(() => {
      const [, setTick] = useState(0);
      useEffect(() => {
        const notify = () => setTick((n) => n + 1);
        stateSubscribers.add(notify);
        return () => {
          stateSubscribers.delete(notify);
        };
      }, []);
      return [currentSearchState, mockStateManager];
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the at_limit banner when the cache reports an overage', async () => {
    mockGetAsTable.mockResolvedValue(buildTable(1000, { continue: 'next' }));

    render();

    expect(await screen.findByRole('alert', atLimitAlert)).toBeInTheDocument();
  });

  it('updates the banner when searchState.result changes (post-mutation reactivity)', async () => {
    mockGetAsTable.mockResolvedValue(buildTable(500));

    render();

    await waitFor(() => {
      expect(mockGetAsTable).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Simulate the state manager finishing a new search after a delete/restore
    // mutation: cache was invalidated, now repopulated with 1000 items, and
    // `setState({ result, loading: false })` hands callers a fresh reference.
    mockGetAsTable.mockResolvedValue(buildTable(1000));
    await act(async () => {
      publishSearchState(defaultSearchState(buildSearchResult(2)));
    });

    expect(await screen.findByRole('alert', atLimitAlert)).toBeInTheDocument();
    expect(mockGetAsTable).toHaveBeenCalledTimes(2);
  });
});
