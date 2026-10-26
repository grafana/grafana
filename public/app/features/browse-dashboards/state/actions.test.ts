import { HttpResponse, http } from 'msw';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler, searchRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { type DashboardViewItem } from 'app/features/search/types';
import { configureStore } from 'app/store/configureStore';

import { type BrowseDashboardsState } from '../types';

import { fetchNextChildrenPage, refetchChildren } from './actions';

setBackendSrv(backendSrv);
setupMockServer();

const PARENT = 'folder-a';

function hit(name: string): DashboardHit {
  return { resource: 'dashboards', name, title: name, folder: PARENT, field: {} };
}

function stateWithFirstPage(items: DashboardViewItem[]): BrowseDashboardsState {
  return {
    rootItems: undefined,
    childrenByParentUID: {
      [PARENT]: {
        items,
        lastFetchedKind: 'dashboard',
        lastFetchedPage: 1,
        lastKindHasMoreItems: true,
        isFullyLoaded: false,
      },
    },
    openFolders: {},
    selectedItems: { $all: false, folder: {}, dashboard: {}, panel: {} },
  };
}

describe('fetchNextChildrenPage', () => {
  it('drops a page that completes after its collection was replaced', async () => {
    const store = configureStore({
      browseDashboards: stateWithFirstPage([{ kind: 'dashboard', uid: 'dash-1', title: 'dash-1' }]),
    });
    const children = () => store.getState().browseDashboards.childrenByParentUID[PARENT]?.items.map((i) => i.uid);

    // Page 2 of the old listing is held; meanwhile a change upstream removes dash-3 and the list is refetched.
    let releaseStalePage!: () => void;
    server.use(
      http.get(searchRoute, async ({ request }) => {
        if (new URL(request.url).searchParams.get('offset') !== '50') {
          return;
        }
        await new Promise<void>((resolve) => (releaseStalePage = resolve));
        return HttpResponse.json({ totalHits: 1, hits: [hit('dash-3')] });
      }),
      getCustomSearchHandler([hit('dash-2')])
    );
    const stalePage = store.dispatch(fetchNextChildrenPage({ parentUID: PARENT, pageSize: 50 }));

    await store.dispatch(refetchChildren({ parentUID: PARENT, pageSize: 50 }));
    expect(children()).toEqual(['dash-2']);

    releaseStalePage();
    await stalePage;

    expect(children()).toEqual(['dash-2']);
  });
});
