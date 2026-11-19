import { http, HttpResponse } from 'msw';

import { type GrafanaConfig, locationUtil, type NavModelItem } from '@grafana/data';
import { config, setBackendSrv } from '@grafana/runtime';
import { getKindDiscoveryHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { MOCK_STARRED_KIND_PAGE, MOCK_STARRED_KIND_SERVED } from '@grafana/test-utils/unstable';
import { type StarsList } from 'app/api/clients/collections/v1alpha1';
import { backendSrv } from 'app/core/services/backend_srv';
import { configureStore } from 'app/store/configureStore';

import {
  findStarredKind,
  findStarredKindBySearchKind,
  getStarredKinds,
  loadStarredKinds,
  loadStarredKindsFor,
  partitionStarred,
} from './kinds';

setBackendSrv(backendSrv);
setupMockServer();

const THING = `${MOCK_STARRED_KIND_SERVED.group}/${MOCK_STARRED_KIND_SERVED.kind}`;
const WIDGETS_SERVED = { group: 'widgets.ext.grafana.app', version: 'v1', kind: 'Widget', plural: 'widgets' };

/**
 * Builds a fresh store from a nav tree holding the given plugin pages, which is where the kinds find their list
 * page. A fresh store also forgets the kinds discovered by the previous test.
 */
function setNavTree(...pages: NavModelItem[]) {
  config.bootData.navTree = [{ id: 'home', text: 'Home', url: '/' }, ...pages];
  configureStore();
}

beforeEach(() => {
  setNavTree(MOCK_STARRED_KIND_PAGE);
  server.use(getKindDiscoveryHandler(MOCK_STARRED_KIND_SERVED));
});

describe('getStarredKinds', () => {
  it("lists only Grafana's own kinds until app kinds are discovered", () => {
    expect(getStarredKinds().map((kind) => kind.searchKind)).toEqual(['dashboard', 'folder']);
  });

  it('lists dashboards, folders, then the app kinds in discovery order', async () => {
    setNavTree(MOCK_STARRED_KIND_PAGE, { id: 'widgets', text: 'Widgets', url: '/a/test-widgets-app/widgets' });
    server.use(getKindDiscoveryHandler(MOCK_STARRED_KIND_SERVED, WIDGETS_SERVED));

    await loadStarredKinds();

    expect(getStarredKinds().map((kind) => [kind.searchKind, kind.source])).toEqual([
      ['dashboard', 'dashboard-search'],
      ['folder', 'dashboard-search'],
      [THING, 'kind-search'],
      ['widgets.ext.grafana.app/Widget', 'kind-search'],
    ]);
  });
});

describe('loadStarredKinds', () => {
  it('describes an app kind from discovery, with the kind name as label and the generic icon', async () => {
    await loadStarredKinds();

    const thing = findStarredKind(MOCK_STARRED_KIND_SERVED.group, MOCK_STARRED_KIND_SERVED.kind);
    expect(thing).toMatchObject({
      searchKind: THING,
      icon: 'cube',
      source: 'kind-search',
      version: 'v1alpha1',
      resource: 'things',
    });
    expect(thing?.getLabel()).toBe('Thing');
    expect(findStarredKindBySearchKind('panel')).toBeUndefined();
  });

  it('leaves out a kind whose plugin has no page at its plural', async () => {
    setNavTree({ id: 'other', text: 'Other', url: '/a/test-things-app/other' });

    await loadStarredKinds();

    expect(findStarredKindBySearchKind(THING)).toBeUndefined();
  });

  it('leaves out a kind two plugins could list, rather than guessing between them', async () => {
    setNavTree(MOCK_STARRED_KIND_PAGE, { id: 'more', text: 'More things', url: '/a/another-app/things' });

    await loadStarredKinds();

    expect(findStarredKindBySearchKind(THING)).toBeUndefined();
  });

  it("never turns Grafana's own kinds into app kinds, even when a plugin page ends in their plural", async () => {
    setNavTree(
      MOCK_STARRED_KIND_PAGE,
      { id: 'dash', text: 'Dashboards', url: '/a/test-things-app/dashboards' },
      { id: 'play', text: 'Playlists', url: '/a/test-things-app/playlists' }
    );
    server.use(
      getKindDiscoveryHandler(
        MOCK_STARRED_KIND_SERVED,
        { group: 'dashboard.grafana.app', version: 'v1beta1', kind: 'Dashboard', plural: 'dashboards' },
        // A core kind Grafana shows no stars of
        { group: 'playlist.grafana.app', version: 'v1', kind: 'Playlist', plural: 'playlists' }
      )
    );

    await loadStarredKinds();

    expect(getStarredKinds().map((kind) => [kind.searchKind, kind.source])).toEqual([
      ['dashboard', 'dashboard-search'],
      ['folder', 'dashboard-search'],
      [THING, 'kind-search'],
    ]);
  });

  it('ignores the app sub url, a query string and a trailing slash on the plugin page', async () => {
    setNavTree({ ...MOCK_STARRED_KIND_PAGE, url: '/grafana/a/test-things-app/things/?orgId=1' });
    locationUtil.initialize({
      config: { appSubUrl: '/grafana' } as GrafanaConfig,
      getTimeRangeForUrl: jest.fn(),
      getVariablesUrlParams: jest.fn(),
    });

    try {
      await loadStarredKinds();
      const thing = findStarredKindBySearchKind(THING);
      if (thing?.source !== 'kind-search') {
        throw new Error('the Thing kind was not discovered as an app kind');
      }
      // The route leaves the app sub url to the link built from it
      expect(thing.getRoute('a b/c')).toBe('/a/test-things-app/things/a%20b%2Fc');
    } finally {
      locationUtil.initialize({
        config: { appSubUrl: '' } as GrafanaConfig,
        getTimeRangeForUrl: jest.fn(),
        getVariablesUrlParams: jest.fn(),
      });
    }
  });

  it('discovers once, and again after a failed load', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const discovery = jest.fn(() => new HttpResponse(null, { status: 503 }));
    server.use(http.get('/apis', discovery));

    await loadStarredKinds();
    expect(discovery).toHaveBeenCalledTimes(1);
    expect(findStarredKindBySearchKind(THING)).toBeUndefined();

    server.use(getKindDiscoveryHandler(MOCK_STARRED_KIND_SERVED));
    await loadStarredKinds();
    await loadStarredKinds();
    expect(findStarredKindBySearchKind(THING)).toBeDefined();
    expect(discovery).toHaveBeenCalledTimes(1);
  });
});

describe('loadStarredKindsFor', () => {
  const starsWith = (...resources: Array<{ group: string; kind: string }>): StarsList => ({
    metadata: {},
    items: [{ metadata: {}, spec: { resource: resources.map(({ group, kind }) => ({ group, kind, names: ['x'] })) } }],
  });

  it('does not discover while the stars hold only dashboards and folders', async () => {
    const discovery = jest.fn(() => HttpResponse.json({ items: [] }));
    server.use(http.get('/apis', discovery));

    await loadStarredKindsFor(starsWith({ group: 'dashboard.grafana.app', kind: 'Dashboard' }));

    expect(discovery).not.toHaveBeenCalled();
  });

  it('discovers as soon as the stars hold another kind', async () => {
    await loadStarredKindsFor(starsWith(MOCK_STARRED_KIND_SERVED));

    expect(findStarredKindBySearchKind(THING)).toBeDefined();
  });
});

describe('partitionStarred', () => {
  const thingResource = { group: MOCK_STARRED_KIND_SERVED.group, kind: MOCK_STARRED_KIND_SERVED.kind, names: ['t1'] };
  const dashboardResource = { group: 'dashboard.grafana.app', kind: 'Dashboard', names: ['d1', 'd2'] };
  const folderResource = { group: 'folder.grafana.app', kind: 'Folder', names: ['f1'] };

  it('sends app kinds to their own search and the rest to the dashboard index, in display order', async () => {
    await loadStarredKinds();

    const { indexed, app } = partitionStarred([thingResource, folderResource, dashboardResource]);

    expect(indexed.map(({ kind, names }) => [kind.searchKind, names])).toEqual([
      ['dashboard', ['d1', 'd2']],
      ['folder', ['f1']],
    ]);
    expect(app.map(({ kind, names }) => [kind.searchKind, names])).toEqual([[THING, ['t1']]]);
  });

  it('leaves out kinds Grafana cannot show and kinds with nothing starred', () => {
    const { indexed, app } = partitionStarred([thingResource, { ...dashboardResource, names: [] }]);

    expect(indexed).toEqual([]);
    expect(app).toEqual([]);
  });
});
