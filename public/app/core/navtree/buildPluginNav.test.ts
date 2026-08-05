import { type NavModelItem } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { config } from '@grafana/runtime';
import { getAppPluginMetasStrict, invalidateCachedPromisesCache } from '@grafana/runtime/internal';
import { setupMockServer } from '@grafana/test-utils/server';
import {
  mockPluginMeta,
  setMockPluginMetas,
  setTestFlags,
  type MockPluginMeta,
  type MockPluginMetaInclude,
} from '@grafana/test-utils/unstable';

import { carryOverRuntimeChildren, mergePluginNavIntoTree } from './buildPluginNav';
import { NavID } from './constants';
import { navIds as ids, setupNavTestState, type NavTestState } from './testUtils';
import { findNavById as findById } from './utils';

setupMockServer();

const setup = ({ permissions = [], ...rest }: NavTestState = {}) =>
  setupNavTestState({ permissions: ['plugins.app:access', ...permissions], orgRole: 'Admin', ...rest });

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
  setMockPluginMetas(metas);
  return getAppPluginMetasStrict();
}

const mergeFromMetas = async (metas: MockPluginMeta[]) => mergePluginNavIntoTree(await fetchApps(metas));

describe('mergePluginNavIntoTree', () => {
  beforeEach(() => {
    setup();
    // The pluginMeta service only fetches metas when the MT plugins flag is on
    setTestFlags({ 'plugins.useMTPlugins': true });
  });

  afterAll(() => {
    setTestFlags({});
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

    const once = mergePluginNavIntoTree(apps);
    const twice = mergePluginNavIntoTree(apps);

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

  it('creates the Alerts & IRM section and nests core alerting inside it', async () => {
    setup({ permissions: ['alert.rules:read'] });

    const merged = await mergeFromMetas([
      appMeta('grafana-irm-app', 'Grafana IRM', [page('IRM', '/a/grafana-irm-app/home')]),
    ]);

    const section = findById(merged, NavID.alertsAndIncidents);
    expect(ids(section?.children ?? [])).toEqual([NavID.alerting, 'plugin-page-grafana-irm-app']);
    expect(findById(section?.children ?? [], NavID.alerting)?.sortWeight).toBe(2);
    expect(merged.find((node) => node.id === NavID.alerting)).toBeUndefined();
    // IRM keeps its section-map text override
    expect(findById(merged, 'plugin-page-grafana-irm-app')?.text).toBe('IRM');
  });

  it('places section-mapped apps and sorts them by their configured weight', async () => {
    const merged = await mergeFromMetas([
      appMeta('grafana-k8s-app', 'Kubernetes App', [page('Clusters', '/a/grafana-k8s-app/clusters')]),
      appMeta('grafana-sigil-app', 'Sigil', [page('AI', '/a/grafana-sigil-app/home')]),
    ]);

    const observability = findById(merged, NavID.observability);
    expect(ids(observability?.children ?? [])).toEqual([
      'plugin-page-grafana-sigil-app',
      'plugin-page-grafana-k8s-app',
    ]);
    expect(findById(merged, 'plugin-page-grafana-k8s-app')?.text).toBe('Kubernetes');
  });

  it('hoists asserts pages into the Observability section as standalone pages', async () => {
    const merged = await mergeFromMetas([
      appMeta('grafana-asserts-app', 'Asserts', [
        page('Service overview', '/a/grafana-asserts-app/services'),
        page('Entities', '/a/grafana-asserts-app/entities'),
      ]),
    ]);

    const observability = findById(merged, NavID.observability);
    expect(findById(merged, 'plugin-page-grafana-asserts-app')).toBeUndefined();
    const childIds = ids(observability?.children ?? []);
    expect(childIds).toContain('standalone-plugin-page-service-overview');
    expect(childIds).toContain('standalone-plugin-page-entities');
    // The services page takes the App Observability slot
    expect(findById(merged, 'standalone-plugin-page-service-overview')?.sortWeight).toBe(4);
  });

  it('removes the asserts Application page when App Observability is present', async () => {
    const merged = await mergeFromMetas([
      appMeta('grafana-asserts-app', 'Asserts', [page('Service overview', '/a/grafana-asserts-app/services')]),
      appMeta('grafana-app-observability-app', 'Application Observability', [
        page('Services', '/a/grafana-app-observability-app/services'),
      ]),
    ]);

    const observability = findById(merged, NavID.observability);
    expect((observability?.children ?? []).map((child) => child.url)).not.toContain('/a/grafana-asserts-app/services');
  });

  it('places single-page apps as a leaf of their configured core section', async () => {
    const merged = await mergeFromMetas([
      appMeta('grafana-auth-app', 'Cloud access policies', [page('Access policies', '/a/grafana-auth-app')]),
    ]);

    const access = findById(merged, NavID.cfgAccess);
    expect(ids(access?.children ?? [])).toEqual(['plugin-page-grafana-auth-app']);

    const authApp = findById(merged, 'plugin-page-grafana-auth-app');
    expect(authApp?.text).toBe('Access policies');
    expect(authApp?.isSection).toBe(false);
    expect(authApp?.children ?? []).toHaveLength(0);
  });

  it('drops a single-page app when its page fails the include access check', async () => {
    setup({ orgRole: 'Viewer' });
    const merged = await mergeFromMetas([
      appMeta('grafana-auth-app', 'Cloud access policies', [
        page('Access policies', '/a/grafana-auth-app', { role: 'Admin' }),
      ]),
    ]);

    expect(findById(merged, 'plugin-page-grafana-auth-app')).toBeUndefined();
  });

  it('nests maintenance windows under the SLO app', async () => {
    const merged = await mergeFromMetas([
      appMeta('grafana-slo-app', 'SLO', [page('SLOs', '/a/grafana-slo-app/home')]),
      appMeta('grafana-maintenancewindows-app', 'Maintenance windows', [
        page('Windows', '/a/grafana-maintenancewindows-app/home'),
      ]),
      appMeta('grafana-servicecenter-app', 'Service center', [page('Home', '/a/grafana-servicecenter-app/home')]),
    ]);

    const slo = findById(merged, 'plugin-page-grafana-slo-app');
    const nested = findById(slo?.children ?? [], 'standalone-plugin-page-grafana-maintenancewindows-app');
    expect(nested).toBeDefined();
    expect(nested?.isNew).toBe(true);
    expect(findById(merged, 'plugin-page-grafana-maintenancewindows-app')).toBeUndefined();
    expect(findById(merged, NavID.apps)).toBeUndefined();
  });

  it('synthesizes a Service center link when SLO is installed without the servicecenter app', async () => {
    const merged = await mergeFromMetas([appMeta('grafana-slo-app', 'SLO', [page('SLOs', '/a/grafana-slo-app/home')])]);

    expect(findById(merged, 'standalone-plugin-page-slo-services')?.url).toBe('/a/grafana-slo-app/services');
  });

  it('does not synthesize Service center when the servicecenter app is installed', async () => {
    const merged = await mergeFromMetas([
      appMeta('grafana-slo-app', 'SLO', [page('SLOs', '/a/grafana-slo-app/home')]),
      appMeta('grafana-servicecenter-app', 'Service center', [page('Home', '/a/grafana-servicecenter-app/home')]),
    ]);

    expect(findById(merged, 'standalone-plugin-page-slo-services')).toBeUndefined();
  });

  it('points the Adaptive Telemetry section at the umbrella plugin when installed', async () => {
    const merged = await mergeFromMetas([
      appMeta('grafana-adaptive-metrics-app', 'Adaptive Metrics', [
        page('Metrics', '/a/grafana-adaptive-metrics-app/home'),
      ]),
      appMeta('grafana-adaptivetelemetry-app', 'Adaptive Telemetry', [
        page('Home', '/a/grafana-adaptivetelemetry-app/home'),
      ]),
    ]);

    const section = findById(merged, NavID.adaptiveTelemetry);
    expect(section?.url).toBe('/a/grafana-adaptivetelemetry-app');
    expect(section?.pluginId).toBe('grafana-adaptivetelemetry-app');
  });

  it('places the advisor app under Administration', async () => {
    const merged = await mergeFromMetas([
      appMeta('grafana-advisor-app', 'Advisor', [page('Advisor', '/a/grafana-advisor-app/home')]),
    ]);

    const cfg = findById(merged, NavID.cfg);
    expect(findById(cfg?.children ?? [], 'plugin-page-grafana-advisor-app')?.text).toBe('Advisor');
  });

  it('marks Help to open interactive learning when the pathfinder plugin is installed', async () => {
    const merged = await mergeFromMetas([appMeta('grafana-pathfinder-app', 'Pathfinder', [])]);

    expect(findById(merged, NavID.help)?.hideFromTabs).toBe(true);
  });

  it('adds an Assistant stub when only the onboarding app is installed', async () => {
    const merged = await mergeFromMetas([appMeta('grafana-assistant-onboarding-app', 'Assistant onboarding', [])]);

    const stub = findById(merged, 'plugin-page-grafana-assistant-app');
    expect(stub?.text).toBe('Assistant');
    expect(stub?.url).toBe('/a/grafana-assistant-app');
  });

  describe('assistant deployment-mode filtering', () => {
    let buildInfo: typeof config.buildInfo;
    let namespace: typeof config.namespace;

    beforeEach(() => {
      buildInfo = config.buildInfo;
      namespace = config.namespace;
    });

    afterEach(() => {
      config.buildInfo = buildInfo;
      config.namespace = namespace;
    });

    it('limits assistant pages to the core set on OSS deployments', async () => {
      config.buildInfo = { ...config.buildInfo, edition: GrafanaEdition.OpenSource };
      config.namespace = 'default';
      const merged = await mergeFromMetas([
        appMeta('grafana-assistant-app', 'Assistant', [
          page('Home', '/a/grafana-assistant-app'),
          page('Workspace', '/a/grafana-assistant-app/workspace'),
          page('Settings', '/a/grafana-assistant-app/settings'),
          page('Investigations', '/a/grafana-assistant-app/investigations'),
        ]),
      ]);

      const assistant = findById(merged, 'plugin-page-grafana-assistant-app');
      expect((assistant?.children ?? []).map((child) => child.text)).toEqual(['Workspace', 'Settings']);
    });

    it('shows every assistant page on cloud stacks', async () => {
      config.buildInfo = { ...config.buildInfo, edition: GrafanaEdition.OpenSource };
      config.namespace = 'stacks-123';
      const merged = await mergeFromMetas([
        appMeta('grafana-assistant-app', 'Assistant', [
          page('Home', '/a/grafana-assistant-app'),
          page('Investigations', '/a/grafana-assistant-app/investigations'),
        ]),
      ]);

      const assistant = findById(merged, 'plugin-page-grafana-assistant-app');
      expect((assistant?.children ?? []).map((child) => child.text)).toEqual(['Investigations']);
    });
  });

  it('does not add the Assistant stub when the real app is installed', async () => {
    const merged = await mergeFromMetas([
      appMeta('grafana-assistant-onboarding-app', 'Assistant onboarding', []),
      appMeta('grafana-assistant-app', 'Assistant', [page('Workspace', '/a/grafana-assistant-app/workspace')]),
    ]);

    const assistant = findById(merged, 'plugin-page-grafana-assistant-app');
    expect(assistant?.children?.length).toBe(1);
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
