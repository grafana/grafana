import { http, HttpResponse } from 'msw';
import { type Store } from 'redux';
import { waitFor } from 'test/test-utils';

import { config, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { MOCK_STARRED_KIND, MOCK_STARRED_KIND_APP, setMockStarredDashboards } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { type StoreState } from 'app/types/store';

import { initStarredKinds } from './kinds';
import { CollectionsStarsSrv } from './service';

const USER_UID = 'test-uid';
const DASHBOARD_GROUP = 'dashboard.grafana.app';
const UPDATE_STARS_URL =
  '/apis/collections.grafana.app/v1alpha1/namespaces/:namespace/stars/:name/update/:group/:kind/:id';

setBackendSrv(backendSrv);
setupMockServer();

// Records every request the mock server sees, so a test can assert the exact star PUT/DELETE.
const seenRequests: Array<{ method: string; path: string }> = [];
server.events.on('request:start', ({ request }) => {
  seenRequests.push({ method: request.method, path: new URL(request.url).pathname });
});

let srv: CollectionsStarsSrv;
let store: Store<StoreState>;

const starredChildren = () => store.getState().navBarTree.find((item) => item.id === 'starred')?.children ?? [];

beforeEach(async () => {
  seenRequests.length = 0;
  contextSrv.isSignedIn = true;
  contextSrv.user.uid = USER_UID;
  config.bootData.navTree = [
    { id: 'home', text: 'Home', url: '/' },
    { id: 'starred', text: 'Starred', children: [] },
  ];
  // Dashboards are the only starrable kind unless a test declares more
  initStarredKinds([]);
  store = configureStore();
  srv = new CollectionsStarsSrv();
});

describe('CollectionsStarsSrv.star', () => {
  it('sends a PUT to the user stars resource and adds the object to the nav Starred section', async () => {
    const uid = 'new-dashboard';
    setMockStarredDashboards([]);

    await srv.star({ group: DASHBOARD_GROUP, kind: 'Dashboard', id: uid, title: 'New Dashboard' });

    expect(seenRequests).toContainEqual({
      method: 'PUT',
      path: `/apis/collections.grafana.app/v1alpha1/namespaces/default/stars/user-${USER_UID}/update/${DASHBOARD_GROUP}/Dashboard/${uid}`,
    });

    const child = starredChildren().find((item) => item.id === `starred/${uid}`);
    expect(child).toMatchObject({ id: `starred/${uid}`, text: 'New Dashboard', url: `/d/${uid}` });
  });

  it('adds a starred plugin object to the nav Starred section under its kind, linking into the plugin', async () => {
    initStarredKinds([MOCK_STARRED_KIND_APP]);
    const name = '7d0c6f1e-3b2a-4c5d-9e8f-0a1b2c3d4e5f';

    await srv.star({ group: MOCK_STARRED_KIND.group, kind: MOCK_STARRED_KIND.kind, id: name, title: 'My Thing' });

    expect(seenRequests).toContainEqual({
      method: 'PUT',
      path: `/apis/collections.grafana.app/v1alpha1/namespaces/default/stars/user-${USER_UID}/update/${MOCK_STARRED_KIND.group}/${MOCK_STARRED_KIND.kind}/${name}`,
    });

    expect(starredChildren().find((item) => item.id === `starred/${name}`)).toMatchObject({
      text: 'My Thing',
      url: `/a/test-things-app/things/${name}`,
      icon: 'cube',
      sortWeight: 2,
      starredKind: `${MOCK_STARRED_KIND.group}/${MOCK_STARRED_KIND.kind}`,
    });
  });
});

describe('CollectionsStarsSrv.unstar', () => {
  it('sends a DELETE and removes the object from the nav Starred section', async () => {
    const uid = 'starred-dashboard';
    setMockStarredDashboards([uid]);
    // Seed the nav entry so there is something to remove.
    await srv.star({ group: DASHBOARD_GROUP, kind: 'Dashboard', id: uid, title: 'Starred Dashboard' });
    expect(starredChildren().some((item) => item.id === `starred/${uid}`)).toBe(true);
    seenRequests.length = 0;

    await srv.unstar({ group: DASHBOARD_GROUP, kind: 'Dashboard', id: uid, title: 'Starred Dashboard' });

    expect(seenRequests).toContainEqual({
      method: 'DELETE',
      path: `/apis/collections.grafana.app/v1alpha1/namespaces/default/stars/user-${USER_UID}/update/${DASHBOARD_GROUP}/Dashboard/${uid}`,
    });
    expect(starredChildren().some((item) => item.id === `starred/${uid}`)).toBe(false);
  });
});

describe('CollectionsStarsSrv.starred', () => {
  it('emits the seeded set, then emits again when a new object is starred', async () => {
    const seeded = ['dash-one', 'dash-two'];
    setMockStarredDashboards(seeded);

    const emissions: string[][] = [];
    const subscription = srv.starred(DASHBOARD_GROUP, 'Dashboard').subscribe((names) => emissions.push(names));

    try {
      await waitFor(() => expect(emissions).toHaveLength(1));
      expect(emissions[0]).toEqual(seeded);

      await srv.star({ group: DASHBOARD_GROUP, kind: 'Dashboard', id: 'dash-three', title: 'Dash Three' });

      await waitFor(() => expect(emissions).toHaveLength(2));
      expect(emissions[1]).toEqual([...seeded, 'dash-three']);
    } finally {
      subscription.unsubscribe();
    }
  });

  it('emits a single empty set for a signed-out user', async () => {
    contextSrv.isSignedIn = false;

    const emissions: string[][] = [];
    const subscription = srv.starred(DASHBOARD_GROUP, 'Dashboard').subscribe((names) => emissions.push(names));
    subscription.unsubscribe();

    expect(emissions).toEqual([[]]);
    expect(seenRequests.some((req) => req.path.endsWith('/stars'))).toBe(false);
  });
});

describe('CollectionsStarsSrv.canStar', () => {
  it('is true for the dashboard kind and false for an undeclared kind', async () => {
    expect(await srv.canStar(DASHBOARD_GROUP, 'Dashboard')).toBe(true);
    expect(await srv.canStar('undeclared.grafana.app', 'Nope')).toBe(false);
  });

  it('is true for a kind an installed app plugin declares', async () => {
    initStarredKinds([MOCK_STARRED_KIND_APP]);

    expect(await srv.canStar(MOCK_STARRED_KIND.group, MOCK_STARRED_KIND.kind)).toBe(true);
  });
});

describe('CollectionsStarsSrv error handling', () => {
  it('rejects and leaves the nav untouched when the server returns 500', async () => {
    const uid = 'rejected-dashboard';
    setMockStarredDashboards([]);
    server.use(http.put(UPDATE_STARS_URL, () => new HttpResponse(null, { status: 500 })));

    await expect(
      srv.star({ group: DASHBOARD_GROUP, kind: 'Dashboard', id: uid, title: 'Rejected Dashboard' })
    ).rejects.toBeDefined();

    expect(starredChildren().some((item) => item.id === `starred/${uid}`)).toBe(false);
  });

  it('rejects when the user is signed out', async () => {
    contextSrv.isSignedIn = false;

    await expect(srv.star({ group: DASHBOARD_GROUP, kind: 'Dashboard', id: 'any', title: 'Any' })).rejects.toThrow();
  });

  it('rejects a kind no installed plugin declares without writing a star', async () => {
    await expect(srv.star({ group: 'gone.ext.grafana.app', kind: 'Ghost', id: 'g1', title: 'Ghost' })).rejects.toThrow(
      'Cannot star gone.ext.grafana.app/Ghost: not a kind this Grafana can show as starred'
    );

    expect(seenRequests.filter((request) => request.method === 'PUT')).toEqual([]);
    expect(starredChildren()).toEqual([]);
  });

  it('refuses to star a folder while folders cannot be starred', async () => {
    await expect(
      srv.star({ group: 'folder.grafana.app', kind: 'Folder', id: 'f1', title: 'My Folder' })
    ).rejects.toThrow('Cannot star folder.grafana.app/Folder');

    expect(seenRequests.filter((request) => request.method === 'PUT')).toEqual([]);
    expect(starredChildren()).toEqual([]);
  });
});
