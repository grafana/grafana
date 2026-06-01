import { act, type ComponentProps, useEffect, useState } from 'react';
import type AutoSizer from 'react-virtualized-auto-sizer';
import { render as testRender, screen, waitFor } from 'test/test-utils';

import { store } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { type ListMeta, type ResourceList } from 'app/features/apiserver/types';
import { type SearchState, SearchLayout } from 'app/features/search/types';
import { type DashboardDataDTO } from 'app/types/dashboard';

import { deletedDashboardsCache } from '../search/service/deletedDashboardsCache';

import RecentlyDeletedPage from './RecentlyDeletedPage';
import { useRecentlyDeletedStateManager, type TrashStateManager } from './api/useRecentlyDeletedStateManager';
import { DISMISS_STORAGE_KEY } from './components/DeletedDashboardsLimitBanner';

setBackendSrv(backendSrv);
setupMockServer();

jest.mock('./api/useRecentlyDeletedStateManager');
jest.mock('../search/service/deletedDashboardsCache', () => ({
  deletedDashboardsCache: {
    getAsResourceList: jest.fn(),
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
const mockGetAsResourceList = deletedDashboardsCache.getAsResourceList as jest.MockedFunction<
  typeof deletedDashboardsCache.getAsResourceList
>;

function buildList(count: number, metadata: Partial<ListMeta> = {}): ResourceList<DashboardDataDTO> {
  return {
    apiVersion: 'v1',
    kind: 'List',
    metadata: { resourceVersion: '0', ...metadata },
    items: Array.from({ length: count }, (_, i) => ({
      apiVersion: 'dashboard.grafana.app/v1beta1',
      kind: 'Dashboard',
      metadata: { name: `d-${i}`, resourceVersion: '0', creationTimestamp: '2024-01-01T00:00:00Z' },
      spec: {} as DashboardDataDTO,
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
    mockGetAsResourceList.mockReset();
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
    mockGetAsResourceList.mockResolvedValue(buildList(1000, { continue: 'next' }));

    render();

    expect(await screen.findByRole('alert', atLimitAlert)).toBeInTheDocument();
  });

  it('updates the banner when searchState.result changes (post-mutation reactivity)', async () => {
    mockGetAsResourceList.mockResolvedValue(buildList(500));

    render();

    await waitFor(() => {
      expect(mockGetAsResourceList).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Simulate the state manager finishing a new search after a delete/restore
    // mutation: cache was invalidated, now repopulated with 1000 items, and
    // `setState({ result, loading: false })` hands callers a fresh reference.
    mockGetAsResourceList.mockResolvedValue(buildList(1000));
    await act(async () => {
      publishSearchState(defaultSearchState(buildSearchResult(2)));
    });

    expect(await screen.findByRole('alert', atLimitAlert)).toBeInTheDocument();
    expect(mockGetAsResourceList).toHaveBeenCalledTimes(2);
  });
});
