import { type NavModelItem } from '@grafana/data';
import { getAppPluginMetas, invalidateCachedPromisesCache, setAppPluginMetas } from '@grafana/runtime/internal';
import { setupMockServer } from '@grafana/test-utils/server';
import {
  mockPluginMeta,
  setMockPluginMetas,
  type MockPluginMeta,
  type MockPluginMetaInclude,
} from '@grafana/test-utils/unstable';

import { carryOverRuntimeChildren, mergePluginNavIntoTree } from './buildPluginNav';
import { buildStaticNavTree } from './buildStaticNavTree';
import { NavID } from './constants';
import { navIds as ids, setupNavTestState, type NavTestState } from './test-utils';
import { findNavById as findById } from './utils';

setupMockServer();

const setup = ({ permissions = [], openFeatureFlags = {}, ...rest }: NavTestState = {}) =>
  setupNavTestState({
    permissions: ['plugins.app:access', ...permissions],
    orgRole: 'Admin',
    // The pluginMeta service only fetches metas when the MT plugins flag is on
    openFeatureFlags: { 'plugins.useMTPlugins': true, ...openFeatureFlags },
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
// the nav consumes in production.
async function fetchApps(metas: MockPluginMeta[]) {
  invalidateCachedPromisesCache();
  // getAppPluginMetas keeps the mapped apps in module state and only fetches
  // when that is empty, so clear it or each test reuses the previous fixture
  setAppPluginMetas({});
  setMockPluginMetas(metas);
  return getAppPluginMetas();
}

const mergeFromMetas = async (metas: MockPluginMeta[]) =>
  mergePluginNavIntoTree(await fetchApps(metas), buildStaticNavTree());

describe('mergePluginNavIntoTree', () => {
  beforeEach(() => {
    setup();
  });

  it('does not mutate the current tree when carrying runtime children over', async () => {
    const currentTree: NavModelItem[] = [
      { id: NavID.starred, text: 'Starred', children: [{ id: 'starred/abc', text: 'My dash', url: '/d/abc' }] },
    ];
    const snapshot = JSON.parse(JSON.stringify(currentTree));

    carryOverRuntimeChildren(await mergeFromMetas([]), currentTree);

    expect(currentTree).toEqual(snapshot);
  });

  it('places unknown apps in a More apps section', async () => {
    const merged = await mergeFromMetas([appMeta('some-app', 'Some app', [page('Page', '/a/some-app/page')])]);

    const apps = findById(merged, NavID.apps);
    expect(apps?.text).toBe('More apps');
    expect(ids(apps?.children ?? [])).toEqual(['plugin-page-some-app']);
  });

  it('is idempotent when merged repeatedly (e.g. a refetch after a remount)', async () => {
    const apps = await fetchApps([appMeta('some-app', 'Some app', [page('Page', '/a/some-app/page')])]);

    const once = mergePluginNavIntoTree(apps, buildStaticNavTree());
    const twice = mergePluginNavIntoTree(apps, buildStaticNavTree());

    expect(twice).toEqual(once);
    expect(ids(findById(twice, NavID.apps)?.children ?? [])).toEqual(['plugin-page-some-app']);
  });

  it('carries runtime-populated starred and bookmark children over from the current tree', async () => {
    setup({ permissions: ['dashboards:read'] });
    const currentTree: NavModelItem[] = [
      { id: NavID.starred, text: 'Starred', children: [{ id: 'starred/abc', text: 'My dash', url: '/d/abc' }] },
      { id: NavID.bookmarks, text: 'Bookmarks', children: [{ id: 'bm', text: 'Bookmarked', url: '/x' }] },
    ];

    const merged = carryOverRuntimeChildren(await mergeFromMetas([]), currentTree);

    expect(ids(findById(merged, NavID.starred)?.children ?? [])).toEqual(['starred/abc']);
    expect(ids(findById(merged, NavID.bookmarks)?.children ?? [])).toEqual(['bm']);
  });

  it('drops apps with no nav children', async () => {
    const merged = await mergeFromMetas([
      appMeta('some-app', 'Some app', [page('Hidden', '/a/some-app/hidden', { addToNav: false })]),
    ]);

    expect(findById(merged, 'plugin-page-some-app')).toBeUndefined();
    expect(findById(merged, NavID.apps)).toBeUndefined();
  });

  it('skips apps the user has no app access permission for', async () => {
    setupNavTestState({ permissions: [] });

    const merged = await mergeFromMetas([appMeta('some-app', 'Some app', [page('Page', '/a/some-app/page')])]);

    expect(findById(merged, 'plugin-page-some-app')).toBeUndefined();
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

    const app = findById(merged, 'plugin-page-some-app');
    expect((app?.children ?? []).map((child) => child.text)).toEqual(['Allowed', 'Editor page']);
  });

  it('promotes the defaultNav include url to the app link and folds it out of children', async () => {
    const merged = await mergeFromMetas([
      appMeta('some-app', 'Some app', [
        page('Overview', '/a/some-app/overview', { defaultNav: true }),
        page('Details', '/a/some-app/details'),
      ]),
    ]);

    const app = findById(merged, 'plugin-page-some-app');
    expect(app?.url).toBe('/a/some-app/overview');
    expect((app?.children ?? []).map((child) => child.text)).toEqual(['Details']);
  });

  // The app link is the page, so it has no children of its own — but it is
  // still placed, matching the order the Go builder applies the two checks in
  it('places an app whose only page is its default nav', async () => {
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

  it('prunes empty attachment shells after the merge', async () => {
    // A viewer's fresh static tree has only the empty connections/cfg shells
    setupNavTestState({ permissions: ['plugins.app:access'] });
    const merged = await mergeFromMetas([]);

    expect(findById(merged, NavID.connections)).toBeUndefined();
    expect(findById(merged, NavID.cfgAccess)).toBeUndefined();
    expect(findById(merged, NavID.cfg)).toBeUndefined();
  });

  it('skips non-app plugins and malformed metas without failing the build', async () => {
    const malformed = { apiVersion: 'v0alpha1', kind: 'Meta', metadata: { name: 'broken' }, spec: {} };
    const merged = await mergeFromMetas(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      [malformed as unknown as MockPluginMeta, mockPluginMeta('loki', 'Loki', { type: 'datasource' })]
    );

    expect(findById(merged, NavID.apps)).toBeUndefined();
  });
});
