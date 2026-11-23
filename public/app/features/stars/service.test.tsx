import { http, HttpResponse } from 'msw';
import { testWithAppKind } from 'test/helpers/testWithAppKind';
import { waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { starsRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { MOCK_APP_KIND, setMockStarredDashboards } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';

import { CollectionsStarsSrv } from './service';

const USER_UID = 'test-uid';
const DASHBOARD_GROUP = 'dashboard.grafana.app';
const { group: THING_GROUP, kind: THING_KIND } = MOCK_APP_KIND;
const UPDATE_STARS_URL =
  '/apis/collections.grafana.app/v1alpha1/namespaces/:namespace/stars/:name/update/:group/:kind/:id';
const updatePath = (group: string, kind: string, id: string) =>
  `/apis/collections.grafana.app/v1alpha1/namespaces/default/stars/user-${USER_UID}/update/${group}/${kind}/${id}`;

setBackendSrv(backendSrv);
setupMockServer();
testWithAppKind();

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
  configureStore();
  srv = new CollectionsStarsSrv();
});

describe('CollectionsStarsSrv.star and unstar', () => {
  it('stars and unstars through the per-object update route of the user stars resource', async () => {
    const uid = 'new-dashboard';
    setMockStarredDashboards([]);

    await srv.star({ group: DASHBOARD_GROUP, kind: 'Dashboard', name: uid });
    await srv.unstar({ group: DASHBOARD_GROUP, kind: 'Dashboard', name: uid });

    expect(seenRequests).toContainEqual({ method: 'PUT', path: updatePath(DASHBOARD_GROUP, 'Dashboard', uid) });
    expect(seenRequests).toContainEqual({ method: 'DELETE', path: updatePath(DASHBOARD_GROUP, 'Dashboard', uid) });
  });

  it('stores a star of a kind Grafana cannot show', async () => {
    await srv.star({ group: 'gone.ext.grafana.app', kind: 'Ghost', name: 'g1' });

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

      await srv.star({ group: DASHBOARD_GROUP, kind: 'Dashboard', name: 'dash-three' });

      await waitFor(() => expect(emissions).toHaveLength(2));
      expect(emissions[1]).toEqual([...seeded, 'dash-three']);
    } finally {
      subscription.unsubscribe();
    }
  });

  it('emits an empty set when the stars cannot be read, then the set once a read succeeds', async () => {
    setMockStarredDashboards(['dash-one']);
    server.use(http.get(starsRoute, () => new HttpResponse(null, { status: 500 }), { once: true }));

    const emissions: string[][] = [];
    const subscription = srv.starred(DASHBOARD_GROUP, 'Dashboard').subscribe((names) => emissions.push(names));

    try {
      await waitFor(() => expect(emissions).toEqual([[]]));

      // A star change re-reads the set, and this time the server answers
      await srv.star({ group: DASHBOARD_GROUP, kind: 'Dashboard', name: 'dash-two' });

      await waitFor(() => expect(emissions).toEqual([[], ['dash-one', 'dash-two']]));
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
  it.each([
    { desc: "Grafana's own dashboard kind", group: DASHBOARD_GROUP, kind: 'Dashboard', expected: true },
    { desc: 'an app kind Grafana has a page for', group: THING_GROUP, kind: THING_KIND, expected: true },
    {
      desc: "a kind of Grafana's own that it shows no stars of",
      group: 'playlist.grafana.app',
      kind: 'Playlist',
      expected: false,
    },
    { desc: 'an app kind Grafana has no page for', group: 'unserved.grafana.app', kind: 'Nope', expected: false },
  ])('is $expected for $desc', async ({ group, kind, expected }) => {
    expect(await srv.canStar(group, kind)).toBe(expected);
  });
});

describe('CollectionsStarsSrv error handling', () => {
  it('rejects with the response when the server refuses the star', async () => {
    server.use(http.put(UPDATE_STARS_URL, () => new HttpResponse(null, { status: 500 })));

    await expect(
      srv.star({ group: DASHBOARD_GROUP, kind: 'Dashboard', name: 'rejected-dashboard' })
    ).rejects.toMatchObject({ status: 500 });
  });

  it('rejects when the user is signed out', async () => {
    contextSrv.isSignedIn = false;

    await expect(srv.star({ group: DASHBOARD_GROUP, kind: 'Dashboard', name: 'any' })).rejects.toThrow(
      'Cannot change stars while signed out'
    );
  });
});
