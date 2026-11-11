import { http, HttpResponse } from 'msw';
import { waitFor } from 'test/test-utils';

import { config, setBackendSrv } from '@grafana/runtime';
import { getKindDiscoveryHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import {
  MOCK_STARRED_KIND_PAGE,
  MOCK_STARRED_KIND_SERVED,
  setMockStarredDashboards,
} from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';

import { CollectionsStarsSrv } from './service';

const USER_UID = 'test-uid';
const DASHBOARD_GROUP = 'dashboard.grafana.app';
const { group: THING_GROUP, kind: THING_KIND } = MOCK_STARRED_KIND_SERVED;
const UPDATE_STARS_URL =
  '/apis/collections.grafana.app/v1alpha1/namespaces/:namespace/stars/:name/update/:group/:kind/:id';
const updatePath = (group: string, kind: string, id: string) =>
  `/apis/collections.grafana.app/v1alpha1/namespaces/default/stars/user-${USER_UID}/update/${group}/${kind}/${id}`;

setBackendSrv(backendSrv);
setupMockServer();

// Records every request the mock server sees, so a test can assert the exact star PUT/DELETE.
const seenRequests: Array<{ method: string; path: string }> = [];
server.events.on('request:start', ({ request }) => {
  seenRequests.push({ method: request.method, path: new URL(request.url).pathname });
});

let srv: CollectionsStarsSrv;

beforeEach(async () => {
  seenRequests.length = 0;
  contextSrv.isSignedIn = true;
  contextSrv.user.uid = USER_UID;
  // The mock plugin's page is what makes its kind one Grafana can show
  config.bootData.navTree = [
    { id: 'home', text: 'Home', url: '/' },
    { id: 'starred', text: 'Starred', children: [] },
    MOCK_STARRED_KIND_PAGE,
  ];
  configureStore();
  srv = new CollectionsStarsSrv();
});

describe('CollectionsStarsSrv.star and unstar', () => {
  it('stars and unstars through the per-object update route of the user stars resource', async () => {
    const uid = 'new-dashboard';
    setMockStarredDashboards([]);

    await srv.star({ group: DASHBOARD_GROUP, kind: 'Dashboard', id: uid, title: 'New Dashboard' });
    await srv.unstar({ group: DASHBOARD_GROUP, kind: 'Dashboard', id: uid, title: 'New Dashboard' });

    expect(seenRequests).toContainEqual({ method: 'PUT', path: updatePath(DASHBOARD_GROUP, 'Dashboard', uid) });
    expect(seenRequests).toContainEqual({ method: 'DELETE', path: updatePath(DASHBOARD_GROUP, 'Dashboard', uid) });
  });

  it('stars an app object under its own group and kind', async () => {
    server.use(getKindDiscoveryHandler(MOCK_STARRED_KIND_SERVED));
    const name = '7d0c6f1e-3b2a-4c5d-9e8f-0a1b2c3d4e5f';

    await srv.star({ group: THING_GROUP, kind: THING_KIND, id: name, title: 'My Thing' });

    expect(seenRequests).toContainEqual({ method: 'PUT', path: updatePath(THING_GROUP, THING_KIND, name) });
  });

  it('stores a star of a kind Grafana cannot show', async () => {
    server.use(getKindDiscoveryHandler());

    await srv.star({ group: 'gone.ext.grafana.app', kind: 'Ghost', id: 'g1', title: 'Ghost' });

    expect(seenRequests).toContainEqual({ method: 'PUT', path: updatePath('gone.ext.grafana.app', 'Ghost', 'g1') });
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
  it('is true for the dashboard kind and false for a kind nobody serves', async () => {
    server.use(getKindDiscoveryHandler());

    expect(await srv.canStar(DASHBOARD_GROUP, 'Dashboard')).toBe(true);
    expect(await srv.canStar('unserved.grafana.app', 'Nope')).toBe(false);
  });

  it('is true for a served kind its plugin has a page for', async () => {
    server.use(getKindDiscoveryHandler(MOCK_STARRED_KIND_SERVED));

    expect(await srv.canStar(THING_GROUP, THING_KIND)).toBe(true);
  });
});

describe('CollectionsStarsSrv error handling', () => {
  it('rejects when the server refuses the star', async () => {
    setMockStarredDashboards([]);
    server.use(http.put(UPDATE_STARS_URL, () => new HttpResponse(null, { status: 500 })));

    await expect(
      srv.star({ group: DASHBOARD_GROUP, kind: 'Dashboard', id: 'rejected-dashboard', title: 'Rejected Dashboard' })
    ).rejects.toBeDefined();
  });

  it('rejects when the user is signed out', async () => {
    contextSrv.isSignedIn = false;

    await expect(srv.star({ group: DASHBOARD_GROUP, kind: 'Dashboard', id: 'any', title: 'Any' })).rejects.toThrow();
  });
});
