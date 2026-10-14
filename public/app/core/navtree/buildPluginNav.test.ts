import { type NavModelItem } from '@grafana/data';
import { getAppPluginMetas, invalidateCachedPromisesCache, setAppPluginMetas } from '@grafana/runtime/internal';
import { setupMockServer } from '@grafana/test-utils/server';
import {
  mockPluginMeta,
  setMockPluginMetas,
  type MockPluginMeta,
  type MockPluginMetaInclude,
} from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';

import { buildStaticSections } from './buildNavTree';
import { applyPluginNav, withPluginNav } from './buildPluginNav';
import { NavID, NavWeight } from './constants';
import { navIds as ids, setupNavTestState, type NavTestState } from './test-utils';
import { findNavById as findById, sortNavTree } from './utils';

setupMockServer();

const setup = ({ permissions = [], openFeatureFlags = {}, ...rest }: NavTestState = {}) =>
  setupNavTestState({
    permissions: ['plugins.app:access', ...permissions],
    orgRole: 'Admin',
    // The pass is gated on the client nav flags as well as the permission
    openFeatureFlags: { 'grafana.multiTenantNavTree': true, 'plugins.useMTPlugins': true, ...openFeatureFlags },
    ...rest,
  });

const appMeta = (id: string, name: string, includes: MockPluginMetaInclude[] = []) =>
  mockPluginMeta(id, name, { includes });

const page = (name: string, path: string, extra: Partial<MockPluginMetaInclude> = {}): MockPluginMetaInclude => ({
  type: 'page',
  name,
  path,
  addToNav: true,
  ...extra,
});

// Serves the metas from the MSW handler and fetches them through the
// grafana-runtime pluginMeta service, exercising the real fetch + mapping path
// the nav consumes in production. getAppPluginMetasSync, which withPluginNav
// reads, returns the same module cache this fills.
async function fetchApps(metas: MockPluginMeta[]) {
  invalidateCachedPromisesCache();
  // getAppPluginMetas keeps the mapped apps in module state and only fetches
  // when that is empty, so clear it or each test reuses the previous fixture
  setAppPluginMetas({});
  setMockPluginMetas(metas);
  return getAppPluginMetas();
}

// Mirrors buildNavTree, minus the prune and the sub-url prefix that
// getInitialNavTree adds after it. The sort matters: apps carry weights that
// only take effect there.
const mergeFromMetas = async (metas: MockPluginMeta[]) =>
  sortNavTree(applyPluginNav(buildStaticSections(), await fetchApps(metas)));

const moreApps = (tree: NavModelItem[]) => findById(tree, NavID.apps);

const childTexts = (tree: NavModelItem[], appId: string) =>
  (findById(tree, `plugin-page-${appId}`)?.children ?? []).map((child) => child.text);

describe('applyPluginNav', () => {
  beforeEach(() => {
    setup();
  });

  describe('withPluginNav', () => {
    const staticTree = (): NavModelItem[] => [{ id: NavID.home, text: 'Home', url: '/' }];

    it('folds the apps in with the flags on and the permission granted', async () => {
      await fetchApps([appMeta('some-app', 'Some app', [page('Page', '/a/some-app/page')])]);

      expect(ids(withPluginNav(staticTree()))).toEqual([NavID.home, NavID.apps]);
    });

    // The flag gate has to short-circuit before the cache is read, because
    // getAppPluginMetasSync throws in development builds when app.ts has not
    // filled it — and app.ts only fills it under this same flag
    it('returns the tree untouched with plugins.useMTPlugins off', async () => {
      await fetchApps([appMeta('some-app', 'Some app', [page('Page', '/a/some-app/page')])]);
      setup({ openFeatureFlags: { 'plugins.useMTPlugins': false } });

      expect(ids(withPluginNav(staticTree()))).toEqual([NavID.home]);
    });

    it('returns the tree untouched without the app access permission', async () => {
      await fetchApps([appMeta('some-app', 'Some app', [page('Page', '/a/some-app/page')])]);
      setupNavTestState({
        openFeatureFlags: { 'grafana.multiTenantNavTree': true, 'plugins.useMTPlugins': true },
      });

      expect(ids(withPluginNav(staticTree()))).toEqual([NavID.home]);
    });

    // Nothing upstream catches for us, and this builds the tree the redux store
    // is created from, so an escaping throw is a blank page, not a missing section
    it('keeps the tree when the pass throws', () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      const permission = jest.spyOn(contextSrv, 'hasPermission').mockImplementation(() => {
        throw new Error('boom');
      });

      expect(ids(withPluginNav(staticTree()))).toEqual([NavID.home]);
      expect(error).toHaveBeenCalledWith('[navtree] failed to apply plugin nav', expect.any(Error));

      permission.mockRestore();
      error.mockRestore();
    });
  });

  describe('placement', () => {
    it('creates a More apps section holding the app links', async () => {
      const merged = await mergeFromMetas([appMeta('some-app', 'Some app', [page('Page', '/a/some-app/page')])]);

      expect(moreApps(merged)).toMatchObject({
        id: NavID.apps,
        text: 'More apps',
        url: '/apps',
        sortWeight: NavWeight.apps,
      });
      expect(ids(moreApps(merged)?.children ?? [])).toEqual(['plugin-page-some-app']);
    });

    it('leaves out apps with no nav children', async () => {
      const merged = await mergeFromMetas([
        appMeta('some-app', 'Some app', [page('Hidden', '/a/some-app/hidden', { addToNav: false })]),
      ]);

      expect(moreApps(merged)).toBeUndefined();
    });

    it('filters includes by RBAC action and role', async () => {
      setup({ orgRole: 'Editor', permissions: ['some-app.pages:read'] });

      const merged = await mergeFromMetas([
        appMeta('some-app', 'Some app', [
          page('Allowed', '/a/some-app/allowed', { action: 'some-app.pages:read' }),
          page('Denied', '/a/some-app/denied', { action: 'some-app.admin:read' }),
          page('Editor page', '/a/some-app/editor', { role: 'Editor' }),
          page('Admin page', '/a/some-app/admin', { role: 'Admin' }),
        ]),
      ]);

      expect(childTexts(merged, 'some-app')).toEqual(['Allowed', 'Editor page']);
    });

    it('promotes the defaultNav include url to the app link and folds it out of children', async () => {
      const merged = await mergeFromMetas([
        appMeta('some-app', 'Some app', [
          page('Overview', '/a/some-app/overview', { defaultNav: true }),
          page('Details', '/a/some-app/details'),
        ]),
      ]);

      expect(findById(merged, 'plugin-page-some-app')?.url).toBe('/a/some-app/overview');
      expect(childTexts(merged, 'some-app')).toEqual(['Details']);
    });

    // The app link is the page, so it has no children of its own — but it is
    // still included, matching the order the Go builder applies the two checks in
    it('includes an app whose only page is its default nav', async () => {
      const merged = await mergeFromMetas([
        appMeta('some-app', 'Some app', [page('Overview', '/a/some-app', { defaultNav: true })]),
      ]);

      const app = findById(merged, 'plugin-page-some-app');
      expect(app?.url).toBe('/a/some-app');
      expect(app?.children).toEqual([]);
    });

    it('adds dashboard includes as /d/ links', async () => {
      const merged = await mergeFromMetas([
        appMeta('some-app', 'Some app', [
          page('Page', '/a/some-app/page'),
          { type: 'dashboard', name: 'Overview dashboard', addToNav: true, uid: 'dash-uid' },
        ]),
      ]);

      const app = findById(merged, 'plugin-page-some-app');
      expect(app?.children?.find((child) => child.text === 'Overview dashboard')?.url).toBe('/d/dash-uid');
    });

    it('skips non-app plugins and malformed metas without failing the build', async () => {
      const malformed = { apiVersion: 'v0alpha1', kind: 'Meta', metadata: { name: 'broken' }, spec: {} };
      const merged = await mergeFromMetas(
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        [malformed as unknown as MockPluginMeta, mockPluginMeta('loki', 'Loki', { type: 'datasource' })]
      );

      expect(moreApps(merged)).toBeUndefined();
    });

    // A malformed meta must cost its own app and nothing else: this runs while
    // the redux store is being created, so a throw would take the whole tree
    it('keeps the other apps when one fails to build', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      // A non-iterable includes makes buildAppLink throw for that app alone
      const apps = [
        { id: 'broken-app', name: 'Broken app', includes: 1 },
        {
          id: 'good-app',
          name: 'Good app',
          includes: [{ type: 'page', name: 'Page', path: '/a/good-app/page', addToNav: true }],
        },
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      ] as never;

      const merged = applyPluginNav(buildStaticSections(), apps);

      expect(ids(moreApps(merged)?.children ?? [])).toEqual(['plugin-page-good-app']);
      expect(warn).toHaveBeenCalledWith(
        '[navtree] failed to build nav for app plugin',
        'broken-app',
        expect.any(Error)
      );
      warn.mockRestore();
    });
  });

  describe('ordering', () => {
    it('orders the apps by title', async () => {
      const merged = await mergeFromMetas([
        appMeta('c-app', 'Charlie', [page('Page', '/a/c-app/page')]),
        appMeta('a-app', 'Alpha', [page('Page', '/a/a-app/page')]),
        appMeta('b-app', 'Bravo', [page('Page', '/a/b-app/page')]),
      ]);

      expect((moreApps(merged)?.children ?? []).map((child) => child.text)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    });

    // These two ids are translated by nav id, and the translated order is the
    // reverse of the raw one — so the sort has to key on the translated title
    it('orders on the translated title, not the name in plugin.json', async () => {
      const merged = await mergeFromMetas([
        appMeta('grafana-k8s-app', 'zzz raw name', [page('Page', '/a/grafana-k8s-app/page')]),
        appMeta('grafana-slo-app', 'aaa raw name', [page('Page', '/a/grafana-slo-app/page')]),
      ]);

      expect(ids(moreApps(merged)?.children ?? [])).toEqual([
        'plugin-page-grafana-k8s-app',
        'plugin-page-grafana-slo-app',
      ]);
    });
  });
});
