import { type AppPluginConfig, type NavModelItem, PluginIncludeType } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { config } from '@grafana/runtime';
import { clearAppPluginMetas, getAppPluginMetas, invalidateCachedPromisesCache } from '@grafana/runtime/internal';
import { setupMockServer } from '@grafana/test-utils/server';
import { mockPluginMeta, setMockPluginMetas, type MockPluginMeta } from '@grafana/test-utils/unstable';

import * as appNavConfig from './appNavConfig';
import { buildNavTree } from './buildNavTree';
import { applyPluginNav } from './buildPluginNav';
import { NavID, NavWeight } from './constants';
import {
  appPage as page,
  appPluginConfig as app,
  navIds as ids,
  setupNavTestState,
  type NavTestState,
} from './test-utils';
import { findNavById as findById, pruneEmptyNavSections } from './utils';

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

    // The lifted page is written before the app is placed, so a throw in between
    // must not leave the page in a tree the app itself never reached
    it('leaves no trace of an app that throws after its pages are lifted', () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      // buildAppLink reads the config first, to lift the page; the throw has to
      // come after that, where the app itself is placed
      let assistantLookups = 0;
      jest.spyOn(appNavConfig, 'appNavConfigFor').mockImplementation((appId) => {
        if (appId === 'grafana-assistant-app' && assistantLookups++ > 0) {
          throw new Error('boom');
        }
        return undefined;
      });

      const merged = merge(
        app('grafana-assistant-app', 'Assistant', [
          page('Home', '/a/grafana-assistant-app'),
          page('Pages', '/a/grafana-assistant-app/pages'),
        ]),
        app('good-app', 'Good app', [page('Page', '/a/good-app/page')])
      );

      expect(findById(merged, 'standalone-plugin-page-/a/grafana-assistant-app/pages')).toBeUndefined();
      expect(findById(merged, 'plugin-page-grafana-assistant-app')).toBeUndefined();
      expect(ids(moreApps(merged)?.children ?? [])).toEqual(['plugin-page-good-app']);
    });
  });

  describe('configured sections', () => {
    it('creates the Alerts & IRM section and nests core alerting inside it', () => {
      setup({ permissions: ['alert.rules:read'] });

      const merged = merge(app('grafana-irm-app', 'Grafana IRM', [page('IRM', '/a/grafana-irm-app/home')]));

      const section = findById(merged, NavID.alertsAndIncidents);
      expect(ids(section?.children ?? [])).toEqual([NavID.alerting, 'plugin-page-grafana-irm-app']);
      expect(findById(section?.children ?? [], NavID.alerting)?.sortWeight).toBe(2);
      expect(merged.find((node) => node.id === NavID.alerting)).toBeUndefined();
      // IRM keeps its section-map text override
      expect(findById(merged, 'plugin-page-grafana-irm-app')?.text).toBe('IRM');
    });

    // The absorb only happens on the creation path, so a section that already
    // exists leaves core Alerting where it is
    it('leaves core alerting alone when the section already exists', () => {
      setup({ permissions: ['alert.rules:read'] });
      const existing: NavModelItem[] = [
        { id: NavID.alerting, text: 'Alerting', url: '/alerting' },
        { id: NavID.alertsAndIncidents, text: 'Alerts & IRM', url: '/alerts-and-incidents', children: [] },
      ];

      const merged = applyPluginNav(existing, [
        app('grafana-irm-app', 'Grafana IRM', [page('IRM', '/a/grafana-irm-app/home')]),
      ]);

      expect(ids(findById(merged, NavID.alertsAndIncidents)?.children ?? [])).toEqual(['plugin-page-grafana-irm-app']);
      expect(merged.find((node) => node.id === NavID.alerting)).toBeDefined();
    });

    it('places section-mapped apps and sorts them by their configured weight', () => {
      const merged = merge(
        app('grafana-k8s-app', 'Kubernetes App', [page('Clusters', '/a/grafana-k8s-app/clusters')]),
        app('grafana-agento11y-app', 'Agent', [page('Agent', '/a/grafana-agento11y-app/home')])
      );

      const observability = findById(merged, NavID.observability);
      expect(ids(observability?.children ?? [])).toEqual([
        'plugin-page-grafana-agento11y-app',
        'plugin-page-grafana-k8s-app',
      ]);
      expect(findById(merged, 'plugin-page-grafana-k8s-app')?.text).toBe('Kubernetes');
    });

    it('takes the Adaptive Telemetry section image from the first member app to attach', () => {
      const merged = merge(
        app('grafana-adaptive-metrics-app', 'Adaptive Metrics', [
          page('Recommendations', '/a/grafana-adaptive-metrics-app/recommendations'),
        ])
      );

      expect(findById(merged, NavID.adaptiveTelemetry)?.img).toBe('/plugins/grafana-adaptive-metrics-app/large.svg');
    });

    // Only root-relative logos take the sub url. The metas mapper leaves a local
    // logo relative (the index page's <base href> resolves it) and a CDN one
    // absolute, and prefixing either would corrupt it.
    it('leaves a logo that is not root-relative alone under an app sub url', () => {
      setup({ config: { appSubUrl: '/grafana' } });
      const large = 'public/plugins/grafana-adaptive-metrics-app/large.svg';

      const merged = merge(
        app(
          'grafana-adaptive-metrics-app',
          'Adaptive Metrics',
          [page('Recommendations', '/a/grafana-adaptive-metrics-app/recommendations')],
          { info: { logos: { small: large, large }, description: 'Adaptive Metrics' } }
        )
      );

      expect(findById(merged, NavID.adaptiveTelemetry)?.img).toBe(large);
    });

    // applyAppSubUrl rewrites url but not img, so the section image is prefixed
    // by hand — which means it must not be prefixed twice
    it('prefixes the section image with the app sub url exactly once', () => {
      setup({ config: { appSubUrl: '/grafana' } });

      const merged = merge(
        app('grafana-adaptive-metrics-app', 'Adaptive Metrics', [
          page('Recommendations', '/a/grafana-adaptive-metrics-app/recommendations'),
        ])
      );

      expect(findById(merged, NavID.adaptiveTelemetry)?.img).toBe(
        '/grafana/plugins/grafana-adaptive-metrics-app/large.svg'
      );
    });

    // The auth app's only page carries its own placement, so the page is lifted
    // into Users and access and the app itself leaves the tree entirely
    it('lifts a configured page out of its app and into the named section', () => {
      const merged = merge(
        app('grafana-auth-app', 'Cloud access policies', [page('Access policies', '/a/grafana-auth-app')])
      );

      const access = findById(merged, NavID.cfgAccess);
      expect(ids(access?.children ?? [])).toEqual(['standalone-plugin-page-/a/grafana-auth-app']);

      const authPage = findById(merged, 'standalone-plugin-page-/a/grafana-auth-app');
      expect(authPage?.text).toBe('Access policies');
      expect(authPage?.sortWeight).toBe(2);
      expect(authPage?.subTitle).toContain('Use policies to control automated access');

      // the app is placed by its page alone, so it has no entry of its own
      expect(findById(merged, 'plugin-page-grafana-auth-app')).toBeUndefined();
      expect(moreApps(merged)).toBeUndefined();
    });

    // The Observability section is created on demand by the first app targeting
    // it, and this page's own app may well be that app — so the page has to be
    // placed after the app, not before it
    it('lifts a configured page into the section its own app creates', () => {
      const merged = merge(
        app('grafana-agento11y-app', 'Agent', [
          page('Agent', '/a/grafana-agento11y-app'),
          page('Fleet', '/a/grafana-agento11y-app/fleet'),
          page('Coding agents', '/a/grafana-agento11y-app/coding-agents'),
        ])
      );

      const observability = findById(merged, NavID.observability);
      expect(ids(observability?.children ?? [])).toEqual([
        'plugin-page-grafana-agento11y-app',
        'standalone-plugin-page-/a/grafana-agento11y-app/coding-agents',
      ]);

      const codingAgents = findById(merged, 'standalone-plugin-page-/a/grafana-agento11y-app/coding-agents');
      expect(codingAgents?.text).toBe('Coding agent');
      expect(codingAgents?.url).toBe('/a/grafana-agento11y-app/coding-agents');
      expect(codingAgents?.isNew).toBe(true);

      // and it is no longer one of the app's own children
      expect(childTexts(merged, 'grafana-agento11y-app')).toEqual(['Fleet']);
    });

    it('lifts a configured page to the top level when it names root', () => {
      // the assistant's own include filter hides /pages on OSS deployments
      const namespace = config.namespace;
      config.namespace = 'stacks-123';
      const merged = merge(
        app('grafana-assistant-app', 'Assistant', [
          page('Home', '/a/grafana-assistant-app'),
          page('Pages', '/a/grafana-assistant-app/pages'),
        ])
      );
      config.namespace = namespace;

      const pagesEntry = findById(merged, 'standalone-plugin-page-/a/grafana-assistant-app/pages');
      expect(ids(merged)).toContain('standalone-plugin-page-/a/grafana-assistant-app/pages');
      expect(pagesEntry?.icon).toBe('pages');
      expect(pagesEntry?.isNew).toBe(true);

      // and it is no longer one of the app's own children
      expect(childTexts(merged, 'grafana-assistant-app')).not.toContain('Pages');
    });

    it('drops that app when its page fails the include access check', () => {
      setup({ orgRole: 'Viewer' });
      const merged = merge(
        app('grafana-auth-app', 'Cloud access policies', [
          page('Access policies', '/a/grafana-auth-app', { role: 'Admin' }),
        ])
      );

      // Asserting on the section, not on the app node: that is absent either way,
      // since this app is placed by its page alone
      expect(findById(merged, NavID.cfgAccess)?.children ?? []).toHaveLength(0);
    });

    // The placement comes from APP_NAV_PATH_CONFIG, not from the plugin, so it
    // applies whatever the include says about addToNav
    it("lifts a configured page that is not in the plugin's own nav", () => {
      const merged = merge(
        app('grafana-auth-app', 'Cloud access policies', [
          page('Access policies', '/a/grafana-auth-app', { addToNav: false }),
        ])
      );

      expect(ids(findById(merged, NavID.cfgAccess)?.children ?? [])).toEqual([
        'standalone-plugin-page-/a/grafana-auth-app',
      ]);
    });

    it('places the advisor app under Administration', () => {
      const merged = merge(app('grafana-advisor-app', 'Advisor', [page('Advisor', '/a/grafana-advisor-app/home')]));

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

    it('limits assistant pages to the core set on OSS deployments', () => {
      config.buildInfo = { ...config.buildInfo, edition: GrafanaEdition.OpenSource };
      config.namespace = 'default';
      const merged = merge(
        app('grafana-assistant-app', 'Assistant', [
          page('Home', '/a/grafana-assistant-app'),
          page('Workspace', '/a/grafana-assistant-app/workspace'),
          page('Settings', '/a/grafana-assistant-app/settings'),
          page('Investigations', '/a/grafana-assistant-app/investigations'),
        ])
      );

      const assistant = findById(merged, 'plugin-page-grafana-assistant-app');
      expect((assistant?.children ?? []).map((child) => child.text)).toEqual(['Workspace', 'Settings']);
    });

    it('shows every assistant page on cloud stacks', () => {
      config.buildInfo = { ...config.buildInfo, edition: GrafanaEdition.OpenSource };
      config.namespace = 'stacks-123';
      const merged = merge(
        app('grafana-assistant-app', 'Assistant', [
          page('Home', '/a/grafana-assistant-app'),
          page('Investigations', '/a/grafana-assistant-app/investigations'),
        ])
      );

      const assistant = findById(merged, 'plugin-page-grafana-assistant-app');
      expect((assistant?.children ?? []).map((child) => child.text)).toEqual(['Investigations']);
    });
  });

  describe('cross-plugin overrides', () => {
    it('hoists asserts pages into the Observability section as standalone pages', () => {
      const merged = merge(
        app('grafana-asserts-app', 'Asserts', [
          page('Service overview', '/a/grafana-asserts-app/services'),
          page('Entities', '/a/grafana-asserts-app/entities'),
        ])
      );

      const observability = findById(merged, NavID.observability);
      expect(findById(merged, 'plugin-page-grafana-asserts-app')).toBeUndefined();
      // The ids do not start with `standalone-plugin-page-/`, so routes.tsx keeps
      // routing these by the app url and the app root keeps this section
      expect(ids(observability?.children ?? [])).toEqual([
        'standalone-plugin-page-a-grafana-asserts-app-entities',
        'standalone-plugin-page-a-grafana-asserts-app-services',
      ]);
      // The services page takes the App Observability slot
      expect(findById(merged, 'standalone-plugin-page-a-grafana-asserts-app-services')?.sortWeight).toBe(5);
    });

    // Mirrors the Go builder's TestAddAppLinksObservabilityAssertsOrdering: the
    // unpinned pages sort above the section's app entries, and the services page
    // takes the slot right after Frontend
    it('orders hoisted pages above the section apps, with the services page in its slot', () => {
      const merged = merge(
        app('grafana-asserts-app', 'Asserts', [
          page('Entity graph', '/a/grafana-asserts-app/entities'),
          page('Service overview', '/a/grafana-asserts-app/services'),
        ]),
        app('grafana-kowalski-app', 'Frontend', [page('Overview', '/a/grafana-kowalski-app/overview')])
      );

      expect((findById(merged, NavID.observability)?.children ?? []).map((child) => child.text)).toEqual([
        'Entity graph',
        'Frontend',
        'Service overview',
      ]);
    });

    // A standalone id is a routing key: `/d/<uid>` as one would register the
    // dashboard's own url as an app route and shadow the dashboard
    it('leaves a hoisted app dashboard without a standalone id', () => {
      const merged = merge(
        app('grafana-asserts-app', 'Asserts', [
          page('Entities', '/a/grafana-asserts-app/entities'),
          { type: PluginIncludeType.dashboard, name: 'Overview dashboard', addToNav: true, uid: 'dash-uid' },
        ])
      );

      const children = findById(merged, NavID.observability)?.children ?? [];
      const dashboard = children.find((child) => child.url === '/d/dash-uid');
      expect(dashboard?.id).toBeUndefined();
      expect(ids(children)).toContain('standalone-plugin-page-a-grafana-asserts-app-entities');
    });

    it('removes the asserts Application page when App Observability is present', () => {
      const merged = merge(
        app('grafana-asserts-app', 'Asserts', [page('Service overview', '/a/grafana-asserts-app/services')]),
        app('grafana-app-observability-app', 'Application Observability', [
          page('Services', '/a/grafana-app-observability-app/services'),
        ])
      );

      const observability = findById(merged, NavID.observability);
      expect((observability?.children ?? []).map((child) => child.url)).not.toContain(
        '/a/grafana-asserts-app/services'
      );
    });

    it('nests maintenance windows under the SLO app', () => {
      const merged = merge(
        app('grafana-slo-app', 'SLO', [page('SLOs', '/a/grafana-slo-app/home')]),
        app('grafana-maintenancewindows-app', 'Maintenance windows', [
          page('Windows', '/a/grafana-maintenancewindows-app/home'),
        ]),
        app('grafana-servicecenter-app', 'Service center', [page('Home', '/a/grafana-servicecenter-app/home')])
      );

      const slo = findById(merged, 'plugin-page-grafana-slo-app');
      const nested = findById(slo?.children ?? [], 'standalone-plugin-page-grafana-maintenancewindows-app');
      expect(nested).toBeDefined();
      // No new badge: the Go builder dropped it
      expect(nested?.isNew).toBeUndefined();
      expect(findById(merged, 'plugin-page-grafana-maintenancewindows-app')).toBeUndefined();
      // Nothing else is left in More apps, so the prune pass drops the section
      expect(findById(merged, NavID.apps)?.children).toEqual([]);
      expect(findById(pruneEmptyNavSections(merged), NavID.apps)).toBeUndefined();
    });

    it('synthesizes a Service center link when SLO is installed without the servicecenter app', () => {
      const merged = merge(app('grafana-slo-app', 'SLO', [page('SLOs', '/a/grafana-slo-app/home')]));

      expect(findById(merged, 'standalone-plugin-page-slo-services')?.url).toBe('/a/grafana-slo-app/services');
    });

    it('does not synthesize Service center when the servicecenter app is installed', () => {
      const merged = merge(
        app('grafana-slo-app', 'SLO', [page('SLOs', '/a/grafana-slo-app/home')]),
        app('grafana-servicecenter-app', 'Service center', [page('Home', '/a/grafana-servicecenter-app/home')])
      );

      expect(findById(merged, 'standalone-plugin-page-slo-services')).toBeUndefined();
    });

    it('points the Adaptive Telemetry section at the umbrella plugin when installed', () => {
      const merged = merge(
        app('grafana-adaptive-metrics-app', 'Adaptive Metrics', [
          page('Metrics', '/a/grafana-adaptive-metrics-app/home'),
        ]),
        app('grafana-adaptivetelemetry-app', 'Adaptive Telemetry', [
          page('Home', '/a/grafana-adaptivetelemetry-app/home'),
        ])
      );

      const section = findById(merged, NavID.adaptiveTelemetry);
      expect(section?.url).toBe('/a/grafana-adaptivetelemetry-app');
      expect(section?.pluginId).toBe('grafana-adaptivetelemetry-app');
    });

    it('marks Help to open interactive learning when the pathfinder plugin is installed', () => {
      const merged = merge(app('grafana-pathfinder-app', 'Pathfinder', []));

      expect(findById(merged, NavID.help)?.hideFromTabs).toBe(true);
    });

    it('adds an Assistant stub when only the onboarding app is installed', () => {
      const merged = merge(app('grafana-assistant-onboarding-app', 'Assistant onboarding', []));

      const stub = findById(merged, 'plugin-page-grafana-assistant-app');
      expect(stub?.text).toBe('Assistant');
      expect(stub?.url).toBe('/a/grafana-assistant-app');
    });

    it('does not add the Assistant stub when the real app is installed', () => {
      const merged = merge(
        app('grafana-assistant-onboarding-app', 'Assistant onboarding', []),
        app('grafana-assistant-app', 'Assistant', [page('Workspace', '/a/grafana-assistant-app/workspace')])
      );

      const assistant = findById(merged, 'plugin-page-grafana-assistant-app');
      expect(assistant?.children?.length).toBe(1);
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
