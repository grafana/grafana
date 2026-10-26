import { type DashboardViewItem } from 'app/features/search/types';
import { configureStore } from 'app/store/configureStore';

import { listDashboards, listFolders } from '../api/services';
import { type BrowseDashboardsState } from '../types';

import { fetchNextChildrenPage, refetchChildren } from './actions';

jest.mock('../api/services', () => ({
  ...jest.requireActual('../api/services'),
  listFolders: jest.fn(),
  listDashboards: jest.fn(),
}));

const mockListFolders = jest.mocked(listFolders);
const mockListDashboards = jest.mocked(listDashboards);

function dashboard(uid: string): DashboardViewItem {
  return { kind: 'dashboard', uid, title: uid };
}

function stateWithRootPage(items: DashboardViewItem[]): BrowseDashboardsState {
  return {
    rootItems: {
      items,
      lastFetchedKind: 'dashboard',
      lastFetchedPage: 1,
      lastKindHasMoreItems: true,
      isFullyLoaded: false,
    },
    childrenByParentUID: {},
    openFolders: {},
    selectedItems: { $all: false, folder: {}, dashboard: {}, panel: {} },
  };
}

describe('fetchNextChildrenPage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('drops a page that completes after its collection was replaced', async () => {
    const store = configureStore({ browseDashboards: stateWithRootPage([dashboard('dash-1')]) });
    const rootUids = () => store.getState().browseDashboards.rootItems?.items.map((item) => item.uid);

    // Page 2 of the old listing is slow; meanwhile a change upstream removes dash-3 and the list is refetched.
    let resolvePage2!: (items: DashboardViewItem[]) => void;
    mockListDashboards.mockReturnValueOnce(new Promise((resolve) => (resolvePage2 = resolve)));
    const stalePage = store.dispatch(fetchNextChildrenPage({ parentUID: undefined, pageSize: 50 }));

    mockListFolders.mockResolvedValue([]);
    mockListDashboards.mockResolvedValueOnce([dashboard('dash-2')]);
    await store.dispatch(refetchChildren({ parentUID: undefined, pageSize: 50 }));
    expect(rootUids()).toEqual(['dash-2']);

    resolvePage2([dashboard('dash-3')]);
    await stalePage;

    expect(rootUids()).toEqual(['dash-2']);
  });
});
