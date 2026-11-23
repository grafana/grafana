import { http, HttpResponse } from 'msw';
import { testWithAppKind } from 'test/helpers/testWithAppKind';
import { testWithStarsUser } from 'test/helpers/testWithStarsUser';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { setBackendSrv } from '@grafana/runtime';
import {
  getAPIGroupHandler,
  getCustomSearchHandler,
  getKindSearchHandler,
  kindSearchRoute,
  type MockAppKindObject,
  searchRoute,
} from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import {
  MOCK_APP_KIND,
  setMockStarredAppKind,
  setMockStarredDashboards,
  setMockStarredFolders,
} from '@grafana/test-utils/unstable';
import { addKinds } from 'app/core/kinds/coreKinds';
import { backendSrv } from 'app/core/services/backend_srv';

import { useStarredSearch } from './hooks';
import { CollectionsStarsSrv } from './service';

const { group: GROUP, kind: KIND, version: VERSION, resource: RESOURCE } = MOCK_APP_KIND;
const DASHBOARD: DashboardHit = { resource: 'dashboards', name: 'dash-1', title: 'Bravo dashboard', field: {} };
const FOLDER: DashboardHit = { resource: 'folders', name: 'folder-1', title: 'Delta folder', field: {} };

setBackendSrv(backendSrv);
setupMockServer();
testWithStarsUser();
testWithAppKind();

// The star button stars through this service
const stars = new CollectionsStarsSrv();

/** The starred search, and the names of its rows. */
function renderStarredSearch() {
  const { result, rerender } = renderHook(() => useStarredSearch(), { wrapper: getWrapper({}) });
  return { result, rerender, rowNames: () => result.current.rows?.map((row) => row.name) };
}

/** Serves the test app kind: its API group, and its search over these objects. */
function serveThings(things: MockAppKindObject[]) {
  server.use(getAPIGroupHandler(GROUP, VERSION), getKindSearchHandler(MOCK_APP_KIND, things));
}

/** Serves the test app kind, holding its search open until `answer` is called; it then finds these objects. */
function holdThingSearch(things: MockAppKindObject[]) {
  let answer = () => {};
  const held = new Promise<void>((resolve) => {
    answer = resolve;
  });
  const asked = jest.fn(async () => {
    await held;
    return HttpResponse.json({
      metadata: { totalHits: things.length, totalHitsRelation: 'eq' },
      items: things.map(({ name, title }) => ({
        resource: { group: GROUP, resource: RESOURCE, kind: KIND, name },
        fields: { title },
      })),
    });
  });
  server.use(getAPIGroupHandler(GROUP, VERSION), http.post(kindSearchRoute(MOCK_APP_KIND), asked));
  return { asked, answer };
}

describe('useStarredSearch', () => {
  beforeEach(() => {
    setMockStarredDashboards([]);
    setMockStarredFolders([]);
    server.use(getCustomSearchHandler([DASHBOARD, FOLDER]));
  });

  it('asks nothing of the API of an app kind while the stars hold none of its objects', async () => {
    setMockStarredDashboards([DASHBOARD.name]);
    const group = jest.fn(() => new HttpResponse(null, { status: 404 }));
    server.use(http.get(`/apis/${GROUP}/`, group));

    const starred = renderStarredSearch();

    await waitFor(() => {
      expect(starred.rowNames()).toEqual(['Bravo dashboard']);
    });
    expect(group).not.toHaveBeenCalled();
  });

  it('lists the starred objects of an app kind with the dashboards and folders, in title order', async () => {
    setMockStarredDashboards([DASHBOARD.name]);
    setMockStarredFolders([FOLDER.name]);
    setMockStarredAppKind(GROUP, KIND, ['t1', 't2']);
    serveThings([
      { name: 't1', title: 'Echo thing' },
      { name: 't2', title: 'Charlie thing' },
    ]);

    const starred = renderStarredSearch();

    await waitFor(() => {
      expect(starred.rowNames()).toEqual(['Bravo dashboard', 'Charlie thing', 'Delta folder', 'Echo thing']);
    });
    expect(starred.result.current.loading).toBe(false);
    expect(starred.result.current.error).toBe(false);
  });

  it('leaves out the stars of a kind that is not in the kind registry', async () => {
    setMockStarredDashboards([DASHBOARD.name]);
    setMockStarredAppKind('others.ext.grafana.app', 'Other', ['o1']);
    const group = jest.fn(() => new HttpResponse(null, { status: 404 }));
    server.use(http.get('/apis/others.ext.grafana.app/', group));

    const starred = renderStarredSearch();

    await waitFor(() => {
      expect(starred.rowNames()).toEqual(['Bravo dashboard']);
    });
    // Nothing says where the page of such an object is, so its kind is not even searched
    expect(group).not.toHaveBeenCalled();
  });

  it('leaves out the stars of an app kind that has no page', async () => {
    addKinds([
      {
        group: 'notes.ext.grafana.app',
        kind: 'Note',
        resource: 'notes',
        folderScoped: false,
        getLabel: () => 'Note',
        getPluralLabel: () => 'Notes',
        icon: 'tag-alt',
      },
    ]);
    setMockStarredDashboards([DASHBOARD.name]);
    setMockStarredAppKind('notes.ext.grafana.app', 'Note', ['n1']);
    const group = jest.fn(() => new HttpResponse(null, { status: 404 }));
    server.use(http.get('/apis/notes.ext.grafana.app/', group));

    const starred = renderStarredSearch();

    await waitFor(() => {
      expect(starred.rowNames()).toEqual(['Bravo dashboard']);
    });
    // A row has nowhere to link to, so the kind is not even searched
    expect(group).not.toHaveBeenCalled();
  });

  it('shows the stars of an app kind its plugin adds after the first search', async () => {
    const late = { group: 'late.ext.grafana.app', version: 'v1', kind: 'Late', resource: 'lates' };
    setMockStarredAppKind(late.group, late.kind, ['l1']);
    server.use(
      getAPIGroupHandler(late.group, late.version),
      getKindSearchHandler(late, [{ name: 'l1', title: 'Late object' }])
    );
    const starred = renderStarredSearch();
    await waitFor(() => {
      expect(starred.result.current.loading).toBe(false);
    });
    expect(starred.rowNames()).toEqual([]);

    // A plugin adds its kinds when its module loads, which may be after a view first rendered
    addKinds([
      {
        group: late.group,
        kind: late.kind,
        resource: late.resource,
        folderScoped: false,
        getLabel: () => 'Late',
        getPluralLabel: () => 'Lates',
        icon: 'cube',
        getRoute: (name) => `/a/late-app/lates/${name}`,
      },
    ]);
    starred.rerender();

    await waitFor(() => {
      expect(starred.rowNames()).toEqual(['Late object']);
    });
  });

  it('lists the dashboards, no longer loading, while the search of an app kind is still out', async () => {
    setMockStarredDashboards([DASHBOARD.name]);
    setMockStarredAppKind(GROUP, KIND, ['t1']);
    const thingSearch = holdThingSearch([{ name: 't1', title: 'Alpha thing' }]);

    const starred = renderStarredSearch();

    await waitFor(() => {
      expect(starred.rowNames()).toEqual(['Bravo dashboard']);
    });
    // There are rows to show, so the API of a plugin does not hold the list up
    expect(starred.result.current.loading).toBe(false);

    thingSearch.answer();
    await waitFor(() => {
      expect(starred.rowNames()).toEqual(['Alpha thing', 'Bravo dashboard']);
    });
  });

  it('stays loading until the search of an app kind answers, when its objects are the only stars', async () => {
    setMockStarredAppKind(GROUP, KIND, ['t1']);
    const thingSearch = holdThingSearch([{ name: 't1', title: 'Alpha thing' }]);

    const starred = renderStarredSearch();

    await waitFor(() => {
      expect(thingSearch.asked).toHaveBeenCalledTimes(1);
    });
    // Not an empty list yet: the only starred objects are still on their way
    expect(starred.result.current.loading).toBe(true);

    thingSearch.answer();
    await waitFor(() => {
      expect(starred.rowNames()).toEqual(['Alpha thing']);
    });
    expect(starred.result.current.loading).toBe(false);
  });

  it('lists a folder starred while the search of an app kind is still out', async () => {
    setMockStarredAppKind(GROUP, KIND, ['t1']);
    const thingSearch = holdThingSearch([{ name: 't1', title: 'Alpha thing' }]);
    const starred = renderStarredSearch();
    await waitFor(() => {
      expect(thingSearch.asked).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await stars.star({ group: 'folder.grafana.app', kind: 'Folder', name: FOLDER.name });
    });

    // The API of a plugin that has yet to answer does not hold up a star made meanwhile
    await waitFor(() => {
      expect(starred.rowNames()).toEqual(['Delta folder']);
    });

    thingSearch.answer();
    await waitFor(() => {
      expect(starred.rowNames()).toEqual(['Alpha thing', 'Delta folder']);
    });
  });

  it('lists the app objects, with the error, when the search of dashboards and folders fails', async () => {
    setMockStarredDashboards([DASHBOARD.name]);
    setMockStarredAppKind(GROUP, KIND, ['t1']);
    serveThings([{ name: 't1', title: 'Alpha thing' }]);
    server.use(http.get(searchRoute, () => HttpResponse.json({}, { status: 500 })));

    const starred = renderStarredSearch();

    // The rows that loaded show, and the error tells a view that they are not all of them
    await waitFor(() => {
      expect(starred.result.current.error).toBe(true);
    });
    await waitFor(() => {
      expect(starred.rowNames()).toEqual(['Alpha thing']);
    });
    expect(starred.result.current.loading).toBe(false);
  });

  it('searches the app kinds again on refetch', async () => {
    setMockStarredAppKind(GROUP, KIND, ['t1']);
    serveThings([{ name: 't1', title: 'Old title' }]);
    const starred = renderStarredSearch();
    await waitFor(() => {
      expect(starred.rowNames()).toEqual(['Old title']);
    });

    serveThings([{ name: 't1', title: 'New title' }]);
    act(() => {
      starred.result.current.refetch();
    });

    await waitFor(() => {
      expect(starred.rowNames()).toEqual(['New title']);
    });
  });

  it('does not bring back an unstarred app object while a newly starred one is searched for', async () => {
    setMockStarredAppKind(GROUP, KIND, ['t1']);
    serveThings([{ name: 't1', title: 'First thing' }]);
    const starred = renderStarredSearch();
    await waitFor(() => {
      expect(starred.rowNames()).toEqual(['First thing']);
    });

    await act(async () => {
      await stars.unstar({ group: GROUP, kind: KIND, name: 't1' });
    });
    await waitFor(() => {
      expect(starred.rowNames()).toEqual([]);
    });

    const thingSearch = holdThingSearch([{ name: 't2', title: 'Second thing' }]);
    await act(async () => {
      await stars.star({ group: GROUP, kind: KIND, name: 't2' });
    });
    await waitFor(() => {
      expect(thingSearch.asked).toHaveBeenCalledTimes(1);
    });

    // The rows of the star set before this one hold no app object either
    expect(starred.rowNames()).toEqual([]);

    thingSearch.answer();
    await waitFor(() => {
      expect(starred.rowNames()).toEqual(['Second thing']);
    });
  });
});
