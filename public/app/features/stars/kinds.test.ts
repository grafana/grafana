import { http, HttpResponse } from 'msw';
import { act } from 'test/test-utils';

import { type GrafanaConfig, locationUtil, type NavModelItem } from '@grafana/data';
import { config, setBackendSrv } from '@grafana/runtime';
import { getKindDiscoveryHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { MOCK_STARRED_KIND_PAGE, MOCK_STARRED_KIND_SERVED, setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { configureStore } from 'app/store/configureStore';

import {
  findStarredKind,
  findStarredKindBySearchKind,
  getStarredKinds,
  loadStarredKinds,
  loadStarredKindsFor,
  resetStarredKinds,
  starredKindsNeedIcons,
  starredNavEntry,
} from './kinds';

setBackendSrv(backendSrv);
setupMockServer();

const THING = `${MOCK_STARRED_KIND_SERVED.group}/${MOCK_STARRED_KIND_SERVED.kind}`;
const WIDGETS_SERVED = { group: 'widgets.ext.grafana.app', version: 'v1', kind: 'Widget', plural: 'widgets' };

/** Builds the store from a nav tree holding the given plugin pages, which is where the kinds find their list page. */
function setNavTree(...pages: NavModelItem[]) {
  config.bootData.navTree = [{ id: 'home', text: 'Home', url: '/' }, ...pages];
  configureStore();
}

beforeEach(() => {
  resetStarredKinds();
  setNavTree(MOCK_STARRED_KIND_PAGE);
  server.use(getKindDiscoveryHandler(MOCK_STARRED_KIND_SERVED));
});

afterEach(async () => {
  await act(async () => {
    setTestFlags({});
  });
});

describe('getStarredKinds', () => {
  it('lists only dashboards when folders cannot be starred and no app kind is loaded', () => {
    expect(getStarredKinds().map((kind) => kind.searchKind)).toEqual(['dashboard']);
    expect(starredKindsNeedIcons()).toBe(false);
  });

  it('lists dashboards, folders, then the app kinds in discovery order with increasing ranks', async () => {
    setTestFlags({ 'grafana.starredFolders': true, foldersAppPlatformAPI: true });
    setNavTree(MOCK_STARRED_KIND_PAGE, { id: 'widgets', text: 'Widgets', url: '/a/test-widgets-app/widgets' });
    server.use(getKindDiscoveryHandler(MOCK_STARRED_KIND_SERVED, WIDGETS_SERVED));

    await loadStarredKinds();

    expect(getStarredKinds().map((kind) => [kind.searchKind, kind.sortWeight, kind.source])).toEqual([
      ['dashboard', 0, 'dashboard-search'],
      ['folder', 1, 'dashboard-search'],
      [THING, 2, 'kind-search'],
      ['widgets.ext.grafana.app/Widget', 3, 'kind-search'],
    ]);
    expect(starredKindsNeedIcons()).toBe(true);
  });
});

describe('loadStarredKinds', () => {
  it('describes an app kind from discovery, with the kind name as label and the generic icon', async () => {
    await loadStarredKinds();

    const thing = findStarredKind(MOCK_STARRED_KIND_SERVED.group, MOCK_STARRED_KIND_SERVED.kind);
    expect(thing).toMatchObject({
      searchKind: THING,
      title: 'Thing',
      icon: 'cube',
      source: 'kind-search',
      version: 'v1alpha1',
      resource: 'things',
    });
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
    setNavTree(MOCK_STARRED_KIND_PAGE, { id: 'dash', text: 'Dashboards', url: '/a/test-things-app/dashboards' });
    server.use(
      getKindDiscoveryHandler(MOCK_STARRED_KIND_SERVED, {
        group: 'dashboard.grafana.app',
        version: 'v1beta1',
        kind: 'Dashboard',
        plural: 'dashboards',
      })
    );

    await loadStarredKinds();

    expect(getStarredKinds().filter((kind) => kind.kind === 'Dashboard')).toHaveLength(1);
    expect(findStarredKindBySearchKind('dashboard')?.source).toBe('dashboard-search');
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
      expect(findStarredKindBySearchKind(THING)?.url('a b/c')).toBe('/grafana/a/test-things-app/things/a%20b%2Fc');
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
  const starsWith = (...resources: Array<{ group: string; kind: string }>) => ({
    items: [{ spec: { resource: resources.map((resource) => ({ ...resource, names: ['x'] })) } }],
  });

  it('does not discover while the stars hold only dashboards and folders', async () => {
    const discovery = jest.fn(() => HttpResponse.json({ items: [] }));
    server.use(http.get('/apis', discovery));

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    await loadStarredKindsFor(starsWith({ group: 'dashboard.grafana.app', kind: 'Dashboard' }) as never);

    expect(discovery).not.toHaveBeenCalled();
  });

  it('discovers as soon as the stars hold another kind', async () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    await loadStarredKindsFor(starsWith(MOCK_STARRED_KIND_SERVED) as never);

    expect(findStarredKindBySearchKind(THING)).toBeDefined();
  });
});

describe('starredNavEntry', () => {
  it('leaves dashboard rows icon-free while dashboards are the only kind', () => {
    expect(starredNavEntry(findStarredKindBySearchKind('dashboard')!, 'd1')).toEqual({
      url: '/d/d1',
      icon: undefined,
      sortWeight: 0,
      kind: 'dashboard',
    });
  });

  it('gives every kind its icon and rank once an app kind is loaded', async () => {
    await loadStarredKinds();

    expect(starredNavEntry(findStarredKindBySearchKind('dashboard')!, 'd1')).toEqual({
      url: '/d/d1',
      icon: 'apps',
      sortWeight: 0,
      kind: 'dashboard',
    });
    expect(starredNavEntry(findStarredKindBySearchKind(THING)!, 't1')).toEqual({
      url: '/a/test-things-app/things/t1',
      icon: 'cube',
      sortWeight: 2,
      kind: THING,
    });
  });
});
