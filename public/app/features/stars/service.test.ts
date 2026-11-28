import { http, HttpResponse } from 'msw';
import { sendWindowFocus } from 'test/helpers/sendWindowFocus';
import { testWithAppKind } from 'test/helpers/testWithAppKind';
import { STARS_USER_UID, testWithStarsUser } from 'test/helpers/testWithStarsUser';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import {
  getAppKindHandlers,
  getCustomSearchHandler,
  getKindSearchHandler,
  starsRoute,
  starUpdateRoute,
} from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { MOCK_APP_KIND, setMockStarred, setMockStarredDashboards } from '@grafana/test-utils/unstable';
import { collectionsAPIv1alpha1 } from 'app/api/clients/collections/v1alpha1';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { dispatch, store } from 'app/store/store';

import { itemStarred } from './analytics/main';
import { invalidateStarredSearch } from './api';
import { useStarredSearch } from './hooks';
import { refetchStarredAppKinds } from './kindSearch';
import { starsSrv } from './service';
import { userStarsFieldSelector } from './utils';

jest.mock('./analytics/main', () => ({
  itemStarred: jest.fn(),
}));

const DASHBOARD_GROUP = 'dashboard.grafana.app';
const { group: THING_GROUP, kind: THING_KIND } = MOCK_APP_KIND;
const updatePath = (group: string, kind: string, id: string) =>
  `/apis/collections.grafana.app/v1alpha1/namespaces/default/stars/user-${STARS_USER_UID}/update/${group}/${kind}/${id}`;

/** Users who have no stars resource to read or write. */
const USERS_WITHOUT_STARS = [
  { desc: 'a signed-out user', become: () => jest.replaceProperty(contextSrv, 'isSignedIn', false) },
  { desc: 'a signed-in user without a uid', become: () => jest.replaceProperty(contextSrv.user, 'uid', '') },
];

setBackendSrv(backendSrv);
setupMockServer();
testWithStarsUser();
testWithAppKind();

// Records every request the mock server sees, so a test can assert the exact star PUT/DELETE.
const seenRequests: Array<{ method: string; path: string }> = [];
server.events.on('request:start', ({ request }) => {
  seenRequests.push({ method: request.method, path: new URL(request.url).pathname });
});

beforeEach(() => {
  seenRequests.length = 0;
  jest.mocked(itemStarred).mockClear();
  // The service reads and dispatches to the app's store
  configureStore();
});

describe('starsSrv.star and unstar', () => {
  it('stars and unstars through the per-object update route of the user stars resource', async () => {
    const uid = 'new-dashboard';
    setMockStarredDashboards([]);

    await starsSrv.star({ group: DASHBOARD_GROUP, kind: 'Dashboard', name: uid });
    await starsSrv.unstar({ group: DASHBOARD_GROUP, kind: 'Dashboard', name: uid });

    expect(seenRequests).toContainEqual({ method: 'PUT', path: updatePath(DASHBOARD_GROUP, 'Dashboard', uid) });
    expect(seenRequests).toContainEqual({ method: 'DELETE', path: updatePath(DASHBOARD_GROUP, 'Dashboard', uid) });
  });

  it('stores a star of a kind Grafana cannot show', async () => {
    await starsSrv.star({ group: 'gone.ext.grafana.app', kind: 'Ghost', name: 'g1' });

    expect(seenRequests).toContainEqual({ method: 'PUT', path: updatePath('gone.ext.grafana.app', 'Ghost', 'g1') });
  });

  it('reports the star and the unstar of an object to analytics, as made through the service', async () => {
    const ref = { group: THING_GROUP, kind: THING_KIND, name: 't1' };

    await starsSrv.star(ref);
    await starsSrv.unstar(ref);

    expect(jest.mocked(itemStarred).mock.calls).toEqual([
      [{ group: THING_GROUP, kind: THING_KIND, status: 'starred', origin: 'StarsSrv' }],
      [{ group: THING_GROUP, kind: THING_KIND, status: 'unstarred', origin: 'StarsSrv' }],
    ]);
  });

  it('shows no notification for a star it stored, which the caller confirms its own way', async () => {
    await starsSrv.star({ group: THING_GROUP, kind: THING_KIND, name: 't1' });

    expect(seenRequests).toContainEqual({ method: 'PUT', path: updatePath(THING_GROUP, THING_KIND, 't1') });
    expect(Object.values(store.getState().appNotifications.byId)).toEqual([]);
  });
});

describe('starsSrv.starred', () => {
  it('emits the seeded set, then emits again when a new object is starred', async () => {
    const seeded = ['dash-one', 'dash-two'];
    setMockStarredDashboards(seeded);

    const emissions: Array<readonly string[]> = [];
    const subscription = starsSrv.starred(DASHBOARD_GROUP, 'Dashboard').subscribe((names) => emissions.push(names));

    try {
      await waitFor(() => expect(emissions).toHaveLength(1));
      expect(emissions[0]).toEqual(seeded);

      await starsSrv.star({ group: DASHBOARD_GROUP, kind: 'Dashboard', name: 'dash-three' });

      await waitFor(() => expect(emissions).toHaveLength(2));
      expect(emissions[1]).toEqual([...seeded, 'dash-three']);
    } finally {
      subscription.unsubscribe();
    }
  });

  it('emits a set changed elsewhere once the window regains focus', async () => {
    setMockStarredDashboards(['dash-one']);

    const emissions: Array<readonly string[]> = [];
    const subscription = starsSrv.starred(DASHBOARD_GROUP, 'Dashboard').subscribe((names) => emissions.push(names));

    try {
      await waitFor(() => expect(emissions).toEqual([['dash-one']]));

      // Starred in another tab, which nothing reports to this window
      setMockStarredDashboards(['dash-one', 'dash-two']);
      sendWindowFocus();

      await waitFor(() => expect(emissions).toEqual([['dash-one'], ['dash-one', 'dash-two']]));
    } finally {
      subscription.unsubscribe();
    }
  });

  it('emits an empty set when the first read fails, then the set once a read succeeds', async () => {
    setMockStarredDashboards(['dash-one']);
    server.use(http.get(starsRoute, () => new HttpResponse(null, { status: 500 }), { once: true }));

    const emissions: Array<readonly string[]> = [];
    const subscription = starsSrv.starred(DASHBOARD_GROUP, 'Dashboard').subscribe((names) => emissions.push(names));

    try {
      await waitFor(() => expect(emissions).toEqual([[]]));

      // A star change re-reads the set, and this time the server answers
      await starsSrv.star({ group: DASHBOARD_GROUP, kind: 'Dashboard', name: 'dash-two' });

      await waitFor(() => expect(emissions).toEqual([[], ['dash-one', 'dash-two']]));
    } finally {
      subscription.unsubscribe();
    }
  });

  it('keeps the set it last read when a later read fails, then emits the set once a read succeeds', async () => {
    setMockStarredDashboards(['dash-one']);

    const emissions: Array<readonly string[]> = [];
    const subscription = starsSrv.starred(DASHBOARD_GROUP, 'Dashboard').subscribe((names) => emissions.push(names));

    try {
      await waitFor(() => expect(emissions).toEqual([['dash-one']]));

      // The read that this star change calls for fails
      const failedRead = jest.fn(() => new HttpResponse(null, { status: 500 }));
      server.use(http.get(starsRoute, failedRead, { once: true }));
      await starsSrv.star({ group: DASHBOARD_GROUP, kind: 'Dashboard', name: 'dash-two' });
      await waitFor(() => expect(failedRead).toHaveBeenCalledTimes(1));

      // The read after the next change succeeds
      await starsSrv.star({ group: DASHBOARD_GROUP, kind: 'Dashboard', name: 'dash-three' });

      await waitFor(() => expect(emissions).toEqual([['dash-one'], ['dash-one', 'dash-two', 'dash-three']]));
    } finally {
      subscription.unsubscribe();
    }
  });

  it.each(USERS_WITHOUT_STARS)('emits a single empty set, and reads no stars, for $desc', ({ become }) => {
    become();

    const emissions: Array<readonly string[]> = [];
    const subscription = starsSrv.starred(DASHBOARD_GROUP, 'Dashboard').subscribe((names) => emissions.push(names));
    subscription.unsubscribe();

    expect(emissions).toEqual([[]]);
    expect(seenRequests).toEqual([]);
  });
});

describe('starsSrv.canStar', () => {
  it('is true for a signed-in user with a uid', () => {
    expect(starsSrv.canStar()).toBe(true);
  });

  it.each(USERS_WITHOUT_STARS)('is false for $desc', ({ become }) => {
    become();

    expect(starsSrv.canStar()).toBe(false);
  });
});

describe('starsSrv.canShowStarsOf', () => {
  it.each([
    { desc: "Grafana's own dashboard kind", group: DASHBOARD_GROUP, kind: 'Dashboard', expected: true },
    { desc: 'an app kind with a page, served or not', group: THING_GROUP, kind: THING_KIND, expected: true },
    {
      desc: "a kind of Grafana's own that it shows no stars of",
      group: 'playlist.grafana.app',
      kind: 'Playlist',
      expected: false,
    },
    { desc: 'an app kind Grafana has no page for', group: 'unserved.grafana.app', kind: 'Nope', expected: false },
  ])('is $expected for $desc', ({ group, kind, expected }) => {
    expect(starsSrv.canShowStarsOf(group, kind)).toBe(expected);
  });
});

describe('starsSrv error handling', () => {
  it('rejects with the response when the server refuses the star', async () => {
    server.use(http.put(starUpdateRoute, () => new HttpResponse(null, { status: 500 })));

    await expect(
      starsSrv.star({ group: DASHBOARD_GROUP, kind: 'Dashboard', name: 'rejected-dashboard' })
    ).rejects.toMatchObject({ status: 500 });
  });

  it("shows Grafana's error notification, and reports nothing to analytics, for a star the server refuses", async () => {
    server.use(http.put(starUpdateRoute, () => new HttpResponse(null, { status: 500 })));

    await expect(
      starsSrv.star({ group: DASHBOARD_GROUP, kind: 'Dashboard', name: 'rejected-dashboard' })
    ).rejects.toBeDefined();

    await waitFor(() =>
      expect(Object.values(store.getState().appNotifications.byId)).toMatchObject([
        { severity: 'error', title: 'Failed to add to starred' },
      ])
    );
    expect(itemStarred).not.toHaveBeenCalled();
  });

  it.each(USERS_WITHOUT_STARS)('rejects, and writes nothing, for $desc', async ({ become }) => {
    become();

    await expect(starsSrv.star({ group: DASHBOARD_GROUP, kind: 'Dashboard', name: 'any' })).rejects.toThrow(
      'Cannot change stars: the current user has no stars resource'
    );
    expect(seenRequests).toEqual([]);
  });
});

describe('starsSrv.resourceUpdated and resourceDeleted', () => {
  const DASHBOARD = { group: DASHBOARD_GROUP, kind: 'Dashboard', name: 'dash-one' };
  const THING = { group: THING_GROUP, kind: THING_KIND, name: 't1' };
  const UNLISTED = { group: 'gone.ext.grafana.app', kind: 'Ghost', name: 'g1' };

  it.each([
    {
      effect: 'searches the dashboards and folders again',
      desc: 'a starred dashboard',
      ref: DASHBOARD,
      searches: [invalidateStarredSearch()],
    },
    {
      effect: 'searches the app kinds again',
      desc: 'a starred app object',
      ref: THING,
      searches: [refetchStarredAppKinds()],
    },
    { effect: 'searches nothing', desc: 'an object that is not starred', ref: { ...THING, name: 't2' }, searches: [] },
    {
      effect: 'searches nothing',
      desc: 'a dashboard named like a starred app object',
      ref: { ...DASHBOARD, name: THING.name },
      searches: [],
    },
    {
      effect: 'searches nothing',
      desc: 'a starred object of a kind Grafana does not list',
      ref: UNLISTED,
      searches: [],
    },
  ])('$effect after a write to $desc', async ({ ref, searches }) => {
    setMockStarredDashboards([DASHBOARD.name]);
    setMockStarred(THING.group, THING.kind, [THING.name]);
    setMockStarred(UNLISTED.group, UNLISTED.kind, [UNLISTED.name]);
    // The star set as a mounted view would have cached it
    await dispatch(collectionsAPIv1alpha1.endpoints.listStars.initiate({ fieldSelector: userStarsFieldSelector() }));
    const dispatched = jest.spyOn(store, 'dispatch');

    starsSrv.resourceUpdated(ref);

    expect(dispatched.mock.calls).toEqual(searches.map((search) => [search]));
  });

  it('drops a starred app object from the starred rows once its deletion is reported', async () => {
    setMockStarredDashboards([]);
    setMockStarred(THING.group, THING.kind, [THING.name]);
    server.use(...getAppKindHandlers(MOCK_APP_KIND, [{ name: THING.name, title: 'Capacity review' }]));
    const { result } = renderHook(() => useStarredSearch(), { wrapper: getWrapper({}) });
    await waitFor(() => expect(result.current.rows?.map((row) => row.name)).toEqual(['Capacity review']));

    // The plugin deleted the object, so its search finds nothing, and tells Grafana
    server.use(getKindSearchHandler(MOCK_APP_KIND, []));
    act(() => starsSrv.resourceDeleted(THING));

    await waitFor(() => expect(result.current.rows?.map((row) => row.name)).toEqual([]));
  });

  it('drops a starred dashboard once the deletion of its folder is reported, though the folder is not starred', async () => {
    setMockStarredDashboards([DASHBOARD.name]);
    server.use(
      getCustomSearchHandler([
        { resource: 'dashboards', name: DASHBOARD.name, title: 'Capacity board', folder: 'parent', field: {} },
      ])
    );
    const { result } = renderHook(() => useStarredSearch(), { wrapper: getWrapper({}) });
    await waitFor(() => expect(result.current.rows?.map((row) => row.name)).toEqual(['Capacity board']));

    // The plugin deleted the folder, which took the dashboard with it, and tells Grafana
    server.use(getCustomSearchHandler([]));
    act(() => starsSrv.resourceDeleted({ group: 'folder.grafana.app', kind: 'Folder', name: 'parent' }));

    await waitFor(() => expect(result.current.rows?.map((row) => row.name)).toEqual([]));
  });
});
