import { type AppPluginConfig, type NavModelItem, PluginIncludeType } from '@grafana/data';
import { getAppPluginMetas, invalidateCachedPromisesCache, clearAppPluginMetas } from '@grafana/runtime/internal';
import { setupMockServer } from '@grafana/test-utils/server';
import { mockPluginMeta, setMockPluginMetas, type MockPluginMeta } from '@grafana/test-utils/unstable';

import { buildNavTree } from './buildNavTree';
import { NavID, NavWeight } from './constants';
import {
  appPage as page,
  appPluginConfig as app,
  navIds as ids,
  setupNavTestState,
  type NavTestState,
} from './test-utils';
import { findNavById as findById } from './utils';

setupMockServer();

const setup = ({ permissions = [], openFeatureFlags = {}, ...rest }: NavTestState = {}) =>
  setupNavTestState({
    permissions: ['plugins.app:access', ...permissions],
    orgRole: 'Admin',
    openFeatureFlags: { 'grafana.multiTenantNavTree': true, 'plugins.useMTPlugins': true, ...openFeatureFlags },
    ...rest,
  });

// applyPluginNav takes the apps, so most cases build them directly. buildNavTree
// is the production pipeline minus the prune and the sub-url prefix that
// getInitialNavTree adds after it; the sort inside it matters, because apps carry
// weights that only take effect there.
const merge = (...apps: AppPluginConfig[]) => buildNavTree(apps);

const moreApps = (tree: NavModelItem[]) => findById(tree, NavID.apps);

const childTexts = (tree: NavModelItem[], appId: string) =>
  (findById(tree, `plugin-page-${appId}`)?.children ?? []).map((child) => child.text);

describe('applyPluginNav', () => {
  beforeEach(() => {
    setup();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('placement', () => {
    it('creates a More apps section holding the app links', () => {
      const merged = merge(app('some-app', 'Some app', [page('Page', '/a/some-app/page')]));

      expect(moreApps(merged)).toMatchObject({
        id: NavID.apps,
        text: 'More apps',
        url: '/apps',
        sortWeight: NavWeight.apps,
      });
      expect(ids(moreApps(merged)?.children ?? [])).toEqual(['plugin-page-some-app']);
    });

    it('leaves out apps with no nav children', () => {
      const merged = merge(app('some-app', 'Some app', [page('Hidden', '/a/some-app/hidden', { addToNav: false })]));

      expect(moreApps(merged)).toBeUndefined();
    });

    it('leaves out every app without the app access permission', () => {
      setupNavTestState({
        openFeatureFlags: { 'grafana.multiTenantNavTree': true, 'plugins.useMTPlugins': true },
      });

      const merged = merge(app('some-app', 'Some app', [page('Page', '/a/some-app/page')]));

      expect(moreApps(merged)).toBeUndefined();
    });

    it('filters includes by RBAC action and role', () => {
      setup({ orgRole: 'Editor', permissions: ['some-app.pages:read'] });

      const merged = merge(
        app('some-app', 'Some app', [
          page('Allowed', '/a/some-app/allowed', { action: 'some-app.pages:read' }),
          page('Denied', '/a/some-app/denied', { action: 'some-app.admin:read' }),
          page('Editor page', '/a/some-app/editor', { role: 'Editor' }),
          page('Admin page', '/a/some-app/admin', { role: 'Admin' }),
        ])
      );

      expect(childTexts(merged, 'some-app')).toEqual(['Allowed', 'Editor page']);
    });

    it('promotes the defaultNav include url to the app link and folds it out of children', () => {
      const merged = merge(
        app('some-app', 'Some app', [
          page('Overview', '/a/some-app/overview', { defaultNav: true }),
          page('Details', '/a/some-app/details'),
        ])
      );

      expect(findById(merged, 'plugin-page-some-app')?.url).toBe('/a/some-app/overview');
      expect(childTexts(merged, 'some-app')).toEqual(['Details']);
    });

    // The app link is the page, so it has no children of its own — but it is
    // still included, matching the order the Go builder applies the two checks in
    it('includes an app whose only page is its default nav', () => {
      const merged = merge(app('some-app', 'Some app', [page('Overview', '/a/some-app', { defaultNav: true })]));

      const appLink = findById(merged, 'plugin-page-some-app');
      expect(appLink?.url).toBe('/a/some-app');
      expect(appLink?.children).toEqual([]);
    });

    it('adds dashboard includes as /d/ links', () => {
      const merged = merge(
        app('some-app', 'Some app', [
          page('Page', '/a/some-app/page'),
          { type: PluginIncludeType.dashboard, name: 'Overview dashboard', addToNav: true, uid: 'dash-uid' },
        ])
      );

      const appLink = findById(merged, 'plugin-page-some-app');
      expect(appLink?.children?.find((child) => child.text === 'Overview dashboard')?.url).toBe('/d/dash-uid');
    });

    // A malformed meta must cost its own app and nothing else: this runs while
    // the redux store is being created, so a throw would take the whole tree
    it('keeps the other apps when one fails to build', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      // A non-iterable includes makes buildAppLink throw for that app alone
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const broken = { id: 'broken-app', name: 'Broken app', includes: 1 } as unknown as AppPluginConfig;

      const merged = merge(broken, app('good-app', 'Good app', [page('Page', '/a/good-app/page')]));

      expect(ids(moreApps(merged)?.children ?? [])).toEqual(['plugin-page-good-app']);
      expect(warn).toHaveBeenCalledWith(
        '[navtree] failed to build nav for app plugin',
        'broken-app',
        expect.any(Error)
      );
    });
  });

  describe('ordering', () => {
    it('orders the apps by title', () => {
      const merged = merge(
        app('c-app', 'Charlie', [page('Page', '/a/c-app/page')]),
        app('a-app', 'Alpha', [page('Page', '/a/a-app/page')]),
        app('b-app', 'Bravo', [page('Page', '/a/b-app/page')])
      );

      expect((moreApps(merged)?.children ?? []).map((child) => child.text)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    });

    // Both ids are translated by nav id — to "Detect" and "Grafana Quaderno" —
    // and the translated order is the reverse of the raw one, so the sort has to
    // key on the title. Neither has a nav config, so both land in More apps.
    it('orders on the translated title, not the name in plugin.json', () => {
      const merged = merge(
        app('grafana-detect-app', 'zzz raw name', [page('Page', '/a/grafana-detect-app/page')]),
        app('grafana-quaderno-app', 'aaa raw name', [page('Page', '/a/grafana-quaderno-app/page')])
      );

      expect(ids(moreApps(merged)?.children ?? [])).toEqual([
        'plugin-page-grafana-detect-app',
        'plugin-page-grafana-quaderno-app',
      ]);
    });
  });

  // The one case that goes through the metas endpoint and the mapper, rather
  // than building AppPluginConfig by hand: everything between the API response
  // and the nav tree.
  describe('from the metas endpoint', () => {
    async function fetchApps(metas: MockPluginMeta[]) {
      invalidateCachedPromisesCache();
      // getAppPluginMetas keeps the mapped apps in module state and only fetches
      // when that is empty, so clear it or each test reuses the previous fixture
      clearAppPluginMetas();
      setMockPluginMetas(metas);
      return getAppPluginMetas();
    }

    it('builds the section from a fetched meta, and skips non-app plugins', async () => {
      const apps = await fetchApps([
        mockPluginMeta('some-app', 'Some app', {
          includes: [{ type: 'page', name: 'Page', path: '/a/some-app/page', addToNav: true }],
        }),
        mockPluginMeta('loki', 'Loki', { type: 'datasource' }),
      ]);

      const merged = buildNavTree(apps);

      expect(ids(moreApps(merged)?.children ?? [])).toEqual(['plugin-page-some-app']);
      expect(childTexts(merged, 'some-app')).toEqual(['Page']);
      // No defaultNav include, so the app link keeps its own /a/<id> url
      expect(findById(merged, 'plugin-page-some-app')?.url).toBe('/a/some-app');
    });
  });
});
