import { type NavModelItem } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { config } from '@grafana/runtime';
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

  describe('configured sections', () => {
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

    // The absorb only happens on the creation path, so a section that already
    // exists leaves core Alerting where it is
    it('leaves core alerting alone when the section already exists', async () => {
      setup({ permissions: ['alert.rules:read'] });
      const existing: NavModelItem[] = [
        { id: NavID.alerting, text: 'Alerting', url: '/alerting' },
        { id: NavID.alertsAndIncidents, text: 'Alerts & IRM', url: '/alerts-and-incidents', children: [] },
      ];

      const merged = applyPluginNav(
        existing,
        await fetchApps([appMeta('grafana-irm-app', 'Grafana IRM', [page('IRM', '/a/grafana-irm-app/home')])])
      );

      expect(ids(findById(merged, NavID.alertsAndIncidents)?.children ?? [])).toEqual(['plugin-page-grafana-irm-app']);
      expect(merged.find((node) => node.id === NavID.alerting)).toBeDefined();
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

    it('takes the Adaptive Telemetry section image from the first member app to attach', async () => {
      const merged = await mergeFromMetas([
        appMeta('grafana-adaptive-metrics-app', 'Adaptive Metrics', [
          page('Recommendations', '/a/grafana-adaptive-metrics-app/recommendations'),
        ]),
      ]);

      expect(findById(merged, NavID.adaptiveTelemetry)?.img).toBe('/plugins/grafana-adaptive-metrics-app/large.svg');
    });

    // applyAppSubUrl rewrites url but not img, so the section image is prefixed
    // by hand — which means it must not be prefixed twice
    it('prefixes the section image with the app sub url exactly once', async () => {
      setup({ config: { appSubUrl: '/grafana' } });

      const merged = await mergeFromMetas([
        appMeta('grafana-adaptive-metrics-app', 'Adaptive Metrics', [
          page('Recommendations', '/a/grafana-adaptive-metrics-app/recommendations'),
        ]),
      ]);

      expect(findById(merged, NavID.adaptiveTelemetry)?.img).toBe(
        '/grafana/plugins/grafana-adaptive-metrics-app/large.svg'
      );
    });

    it('places an app whose only page is its default nav into its configured section', async () => {
      const merged = await mergeFromMetas([
        appMeta('grafana-auth-app', 'Cloud access policies', [page('Access policies', '/a/grafana-auth-app')]),
      ]);

      const access = findById(merged, NavID.cfgAccess);
      expect(ids(access?.children ?? [])).toEqual(['plugin-page-grafana-auth-app']);

      const authApp = findById(merged, 'plugin-page-grafana-auth-app');
      expect(authApp?.text).toBe('Access policies');
      expect(authApp?.children ?? []).toHaveLength(0);
    });

    it('drops that app when its page fails the include access check', async () => {
      setup({ orgRole: 'Viewer' });
      const merged = await mergeFromMetas([
        appMeta('grafana-auth-app', 'Cloud access policies', [
          page('Access policies', '/a/grafana-auth-app', { role: 'Admin' }),
        ]),
      ]);

      expect(findById(merged, 'plugin-page-grafana-auth-app')).toBeUndefined();
    });

    it('places the advisor app under Administration', async () => {
      const merged = await mergeFromMetas([
        appMeta('grafana-advisor-app', 'Advisor', [page('Advisor', '/a/grafana-advisor-app/home')]),
      ]);

      const cfg = findById(merged, NavID.cfg);
      expect(findById(cfg?.children ?? [], 'plugin-page-grafana-advisor-app')?.text).toBe('Advisor');
    });
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

  describe('cross-plugin overrides', () => {
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
      expect((observability?.children ?? []).map((child) => child.url)).not.toContain(
        '/a/grafana-asserts-app/services'
      );
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
      const merged = await mergeFromMetas([
        appMeta('grafana-slo-app', 'SLO', [page('SLOs', '/a/grafana-slo-app/home')]),
      ]);

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

    it('does not add the Assistant stub when the real app is installed', async () => {
      const merged = await mergeFromMetas([
        appMeta('grafana-assistant-onboarding-app', 'Assistant onboarding', []),
        appMeta('grafana-assistant-app', 'Assistant', [page('Workspace', '/a/grafana-assistant-app/workspace')]),
      ]);

      const assistant = findById(merged, 'plugin-page-grafana-assistant-app');
      expect(assistant?.children?.length).toBe(1);
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

    // Both ids are translated by nav id — to "Detect" and "Grafana Quaderno" —
    // and the translated order is the reverse of the raw one, so the sort has to
    // key on the title. Neither has a nav config, so both land in More apps.
    it('orders on the translated title, not the name in plugin.json', async () => {
      const merged = await mergeFromMetas([
        appMeta('grafana-detect-app', 'zzz raw name', [page('Page', '/a/grafana-detect-app/page')]),
        appMeta('grafana-quaderno-app', 'aaa raw name', [page('Page', '/a/grafana-quaderno-app/page')]),
      ]);

      expect(ids(moreApps(merged)?.children ?? [])).toEqual([
        'plugin-page-grafana-detect-app',
        'plugin-page-grafana-quaderno-app',
      ]);
    });
  });
});
