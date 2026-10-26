import { HttpResponse, http } from 'msw';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler, searchRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { type DashboardViewItem } from 'app/features/search/types';
import { configureStore } from 'app/store/configureStore';

import { type BrowseDashboardsState, type DashboardViewItemCollection } from '../types';

import { fetchNextChildrenPage, refetchChildren } from './actions';
import { clearFolders } from './slice';

setBackendSrv(backendSrv);
setupMockServer();

const PARENT = 'folder-a';
const PAGE_SIZE = 50;

function hit(name: string): DashboardHit {
  return { resource: 'dashboards', name, title: name, folder: PARENT, field: {} };
}

function dashboard(uid: string): DashboardViewItem {
  return { kind: 'dashboard', uid, title: uid };
}

function stateWith(collection: DashboardViewItemCollection | undefined): BrowseDashboardsState {
  return {
    rootItems: undefined,
    childrenByParentUID: { [PARENT]: collection },
    openFolders: {},
    selectedItems: { $all: false, folder: {}, dashboard: {}, panel: {} },
  };
}

const firstPageOf = (items: DashboardViewItem[]): DashboardViewItemCollection => ({
  items,
  lastFetchedKind: 'dashboard',
  lastFetchedPage: 1,
  lastKindHasMoreItems: true,
  isFullyLoaded: false,
});

/** Holds the first search request matching `match` until released; later ones fall through. */
function holdSearch(match: (url: URL) => boolean) {
  let release!: (hits: DashboardHit[]) => void;
  const held = new Promise<DashboardHit[]>((resolve) => (release = resolve));
  let taken = false;
  server.use(
    http.get(searchRoute, async ({ request }) => {
      if (taken || !match(new URL(request.url))) {
        return;
      }
      taken = true;
      const hits = await held;
      return HttpResponse.json({ totalHits: hits.length, hits });
    })
  );
  return release;
}

const isPage = (offset: number) => (url: URL) => (url.searchParams.get('offset') ?? '0') === String(offset);

describe('browse-dashboards loading thunks', () => {
  const pagesRequested: string[] = [];

  beforeEach(() => {
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith('/search') && url.searchParams.get('folder') === PARENT) {
        pagesRequested.push(url.searchParams.get('offset') ?? '0');
      }
    });
  });

  afterEach(() => {
    server.events.removeAllListeners('request:start');
    pagesRequested.length = 0;
  });

  it('reloads a page against the current listing when the collection was replaced while it was in flight', async () => {
    // The listing after the change upstream spans two pages and no longer has dash-1 or dash-3.
    const newListing = Array.from({ length: PAGE_SIZE + 10 }, (_, index) => hit(`new-${index}`));
    server.use(getCustomSearchHandler(newListing));
    const store = configureStore({ browseDashboards: stateWith(firstPageOf([dashboard('dash-1')])) });
    const collection = () => store.getState().browseDashboards.childrenByParentUID[PARENT];

    const releaseOldPage = holdSearch(isPage(PAGE_SIZE));
    const nextPage = store.dispatch(fetchNextChildrenPage({ parentUID: PARENT, pageSize: PAGE_SIZE }));

    await store.dispatch(refetchChildren({ parentUID: PARENT, pageSize: PAGE_SIZE }));
    expect(collection()?.items).toHaveLength(PAGE_SIZE);

    releaseOldPage([hit('dash-3')]);
    await nextPage;

    // The old page is not appended; page 2 of the new listing is loaded in its place.
    const uids = collection()?.items.map((i) => i.uid);
    expect(uids).toHaveLength(PAGE_SIZE + 10);
    expect(uids).not.toContain('dash-3');
    expect(collection()?.isFullyLoaded).toBe(true);
    expect(pagesRequested.filter((offset) => offset === String(PAGE_SIZE))).toHaveLength(2);
  });

  it('reloads the first page when the folder was dropped while it was in flight', async () => {
    server.use(getCustomSearchHandler([hit('dash-2')]));
    const store = configureStore({ browseDashboards: stateWith(undefined) });
    const collection = () => store.getState().browseDashboards.childrenByParentUID[PARENT];

    const releaseOldPage = holdSearch(isPage(0));
    const firstPage = store.dispatch(fetchNextChildrenPage({ parentUID: PARENT, pageSize: PAGE_SIZE }));

    store.dispatch(clearFolders([PARENT]));
    releaseOldPage([hit('dash-1')]);
    await firstPage;

    expect(collection()?.items.map((i) => i.uid)).toEqual(['dash-2']);
  });

  it('discards an older refetch that completes after a newer one', async () => {
    server.use(getCustomSearchHandler([hit('dash-2')]));
    const store = configureStore({ browseDashboards: stateWith(firstPageOf([dashboard('dash-1')])) });
    const collection = () => store.getState().browseDashboards.childrenByParentUID[PARENT];

    const releaseOlder = holdSearch(isPage(0));
    const older = store.dispatch(refetchChildren({ parentUID: PARENT, pageSize: PAGE_SIZE }));

    await store.dispatch(refetchChildren({ parentUID: PARENT, pageSize: PAGE_SIZE }));
    expect(collection()?.items.map((i) => i.uid)).toEqual(['dash-2']);

    releaseOlder([hit('dash-1')]);
    await older;

    expect(collection()?.items.map((i) => i.uid)).toEqual(['dash-2']);
  });
});
