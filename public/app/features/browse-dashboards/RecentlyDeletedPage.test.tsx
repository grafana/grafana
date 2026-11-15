import { act, type ComponentProps, useEffect, useState } from 'react';
import type AutoSizer from 'react-virtualized-auto-sizer';
import { render as testRender, screen } from 'test/test-utils';

import { store } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { type SearchState, SearchLayout } from 'app/features/search/types';

import { deletedDashboardsCache } from '../search/service/deletedDashboardsCache';

import RecentlyDeletedPage from './RecentlyDeletedPage';
import { useRecentlyDeletedStateManager, type TrashStateManager } from './api/useRecentlyDeletedStateManager';
import { DISMISS_STORAGE_KEY } from './components/DeletedDashboardsLimitBanner';

setBackendSrv(backendSrv);
setupMockServer();

jest.mock('./api/useRecentlyDeletedStateManager');
jest.mock('../search/service/deletedDashboardsCache', () => ({
  DELETED_DASHBOARDS_LIMIT: jest.requireActual('../search/service/deletedDashboardsCache').DELETED_DASHBOARDS_LIMIT,
  deletedDashboardsCache: {
    isTrashUnavailable: jest.fn().mockReturnValue(false),
    isTrashTruncated: jest.fn().mockReturnValue(false),
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
const mockIsTrashTruncated = deletedDashboardsCache.isTrashTruncated as jest.MockedFunction<
  typeof deletedDashboardsCache.isTrashTruncated
>;

const mockIsTrashUnavailable = deletedDashboardsCache.isTrashUnavailable as jest.MockedFunction<
  typeof deletedDashboardsCache.isTrashUnavailable
>;

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

const atLimitAlert = { name: /showing at most 1000 deleted dashboards/i };

describe('RecentlyDeletedPage banner integration', () => {
  beforeEach(() => {
    store.delete(DISMISS_STORAGE_KEY);
    mockIsTrashTruncated.mockReturnValue(false);
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

  it('renders the at_limit banner when the cache reports truncation', async () => {
    mockIsTrashTruncated.mockReturnValue(true);

    render();

    expect(await screen.findByRole('status', atLimitAlert)).toBeInTheDocument();
  });

  // The banner reads the cache during render, so this is what keeps it current: a finished
  // search re-renders the page, and with it the banner.
  it('updates the banner when a search finishes, e.g. after a delete or restore', async () => {
    render();
    expect(screen.queryByRole('status', atLimitAlert)).not.toBeInTheDocument();

    mockIsTrashTruncated.mockReturnValue(true);
    await act(async () => {
      publishSearchState(defaultSearchState(buildSearchResult(2)));
    });

    expect(await screen.findByRole('status', atLimitAlert)).toBeInTheDocument();
  });
});

describe('RecentlyDeletedPage when trash is unavailable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockIsTrashUnavailable.mockReturnValue(false);
  });

  it('replaces the empty state, so the page does not also claim nothing was deleted', async () => {
    mockIsTrashUnavailable.mockReturnValue(true);
    publishSearchState(defaultSearchState(buildSearchResult(1)));

    render();

    expect(await screen.findByRole('alert', { name: /recently deleted is unavailable/i })).toBeInTheDocument();
    expect(screen.queryByText(/haven't deleted any dashboards/i)).not.toBeInTheDocument();
  });

  it('shows the normal empty state when trash is available', async () => {
    mockIsTrashUnavailable.mockReturnValue(false);
    publishSearchState(defaultSearchState(buildSearchResult(2)));

    render();

    expect(await screen.findByText(/haven't deleted any dashboards/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert', { name: /recently deleted is unavailable/i })).not.toBeInTheDocument();
  });
});
