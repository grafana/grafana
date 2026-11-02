import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler, searchRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { type DashboardViewItem } from 'app/features/search/types';
import { configureStore } from 'app/store/configureStore';

import { type BrowseDashboardsState, type DashboardViewItemCollection } from '../types';

import { fetchNextChildrenPage, refetchChildren } from './actions';
import { useLoadNextChildrenPage } from './hooks';
import { clearFolders } from './slice';

setBackendSrv(backendSrv);
setupMockServer();

const PARENT = 'folder-a';
const PAGE_SIZE = 50;

const hit = (name: string): DashboardHit => ({ resource: 'dashboards', name, title: name, folder: PARENT, field: {} });
const dashboard = (uid: string): DashboardViewItem => ({ kind: 'dashboard', uid, title: uid });

const firstPageOf = (items: DashboardViewItem[]): DashboardViewItemCollection => ({
  items,
  lastFetchedKind: 'dashboard',
  lastFetchedPage: 1,
  lastKindHasMoreItems: true,
  isFullyLoaded: false,
});

function storeWith(collection: DashboardViewItemCollection | undefined) {
  const browseDashboards: BrowseDashboardsState = {
    rootItems: undefined,
    childrenByParentUID: { [PARENT]: collection },
    openFolders: {},
    selectedItems: { $all: false, folder: {}, dashboard: {}, panel: {} },
  };
  const store = configureStore({ browseDashboards });
  const uids = () => store.getState().browseDashboards.childrenByParentUID[PARENT]?.items.map((i) => i.uid);
  return { store, uids };
}

/**
 * Holds the first `count` searches for the given page offset until released, in order; everything
 * else gets `listing`.
 */
function holdPages(offset: number, count: number, listing = [hit('dash-2')]) {
  const releases: Array<(hits: DashboardHit[]) => void> = [];
  const held = Array.from({ length: count }, () => new Promise<DashboardHit[]>((resolve) => releases.push(resolve)));
  let taken = 0;
  server.use(
    http.get(searchRoute, async ({ request }) => {
      if (taken >= count || (new URL(request.url).searchParams.get('offset') ?? '0') !== String(offset)) {
        return;
      }
      const hits = await held[taken++];
      return HttpResponse.json({ totalHits: hits.length, hits });
    }),
    getCustomSearchHandler(listing)
  );
  return (index: number, hits: DashboardHit[]) => releases[index](hits);
}

const holdPage = (offset: number, listing?: DashboardHit[]) => {
  const release = holdPages(offset, 1, listing);
  return (hits: DashboardHit[]) => release(0, hits);
};

describe('browse-dashboards tree loading', () => {
  it('drops a page that completes after its collection was replaced', async () => {
    const { store, uids } = storeWith(firstPageOf([dashboard('dash-1')]));
    const release = holdPage(PAGE_SIZE);
    const stalePage = store.dispatch(fetchNextChildrenPage({ parentUID: PARENT, pageSize: PAGE_SIZE }));

    await store.dispatch(refetchChildren({ parentUID: PARENT, pageSize: PAGE_SIZE }));
    expect(uids()).toEqual(['dash-2']);

    release([hit('dash-3')]);
    await stalePage;
    expect(uids()).toEqual(['dash-2']);
  });

  it('drops a first page that completes after the folder was dropped', async () => {
    const { store, uids } = storeWith(undefined);
    const release = holdPage(0);
    const firstPage = store.dispatch(fetchNextChildrenPage({ parentUID: PARENT, pageSize: PAGE_SIZE }));

    store.dispatch(clearFolders([PARENT]));
    release([hit('dash-1')]);
    await firstPage;
    expect(uids()).toBeUndefined();
  });

  it('keeps the refetch started last, whichever lands first', async () => {
    const { store, uids } = storeWith(firstPageOf([dashboard('dash-1')]));
    const release = holdPages(0, 2);
    const older = store.dispatch(refetchChildren({ parentUID: PARENT, pageSize: PAGE_SIZE }));
    const newer = store.dispatch(refetchChildren({ parentUID: PARENT, pageSize: PAGE_SIZE }));

    // Older lands first: ignored, the newer one is still owed.
    release(0, [hit('dash-1')]);
    await older;
    expect(uids()).toEqual(['dash-1']);

    release(1, [hit('dash-2')]);
    await newer;
    expect(uids()).toEqual(['dash-2']);

    // Newer lands first: applied, the older one is ignored when it arrives.
    const release2 = holdPages(0, 2);
    const older2 = store.dispatch(refetchChildren({ parentUID: PARENT, pageSize: PAGE_SIZE }));
    const newer2 = store.dispatch(refetchChildren({ parentUID: PARENT, pageSize: PAGE_SIZE }));
    release2(1, [hit('dash-3')]);
    await newer2;
    expect(uids()).toEqual(['dash-3']);
    release2(0, [hit('dash-1')]);
    await older2;
    expect(uids()).toEqual(['dash-3']);
  });

  it('loads the page again when the one in flight was dropped, since the tree will not ask twice', async () => {
    const { store, uids } = storeWith(firstPageOf([dashboard('dash-1')]));
    const newListing = Array.from({ length: PAGE_SIZE + 10 }, (_, index) => hit(`new-${index}`));
    const release = holdPage(PAGE_SIZE, newListing);
    const { result } = renderHook(() => useLoadNextChildrenPage(), { wrapper: getWrapper({ store }) });

    result.current(PARENT);
    await store.dispatch(refetchChildren({ parentUID: PARENT, pageSize: PAGE_SIZE }));
    release([hit('dash-3')]);

    await waitFor(() => expect(uids()).toHaveLength(PAGE_SIZE + 10));
    expect(uids()).not.toContain('dash-3');
  });
});
