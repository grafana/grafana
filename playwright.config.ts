import { defineConfig, devices, type PlaywrightTestConfig, type Project } from '@playwright/test';
import path, { dirname } from 'path';

import { type PluginOptions } from '@grafana/plugin-e2e';

export const testDirRoot = 'e2e-playwright';
const pluginDirRoot = path.join(testDirRoot, 'plugin-e2e');
export const DEFAULT_URL = 'http://localhost:3001';

// The new rule lists need backend feature flags that are fixed at server startup, so their specs
// run against a second Grafana server started with its own config
// (scripts/grafana-server/custom-gma-rule-list.ini). Their projects are defined only when
// GMA_RULE_LIST_SERVER is set, which also moves the default URL and the auto-started server to that
// second one; select them with --project (`pnpm e2e:playwright:gma-list`). The default shards never
// define them, so the old-list specs keep running on the default server.
const gmaRuleListServer = process.env.GMA_RULE_LIST_SERVER === 'true';
const GMA_RULE_LIST_URL = 'http://localhost:3011';
const serverUrl = gmaRuleListServer ? GMA_RULE_LIST_URL : DEFAULT_URL;

export function withAuth(project: Project): Project {
  project.dependencies ??= [];
  project.use ??= {};

  project.dependencies = project.dependencies.concat('authenticate');
  project.use = {
    ...project.use,
    storageState: `playwright/.auth/${process.env.GRAFANA_ADMIN_USER || 'admin'}.json`,
  };

  return project;
}

export const baseConfig: PlaywrightTestConfig<PluginOptions, {}> = {
  fullyParallel: true,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['html'], // pretty
    ['./e2e-playwright/utils/axe-a11y/reporter.ts'], // accessibility reporter
  ],
  expect: {
    timeout: 10_000,
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.GRAFANA_URL ?? DEFAULT_URL,
    trace: 'retain-on-failure',
    httpCredentials: {
      username: 'admin',
      password: 'admin',
    },
    screenshot: 'only-on-failure',
    permissions: ['clipboard-read', 'clipboard-write'],
    provisioningRootDir: path.join(process.cwd(), process.env.PROV_DIR ?? 'conf/provisioning'),
  },
};

// The second server runs from its own run directory so starting it never replaces the default
// server's files; the extra ini turns on the backend flags the new lists need.
const gmaRuleListServerEnv =
  'PORT=3011 RUNDIR=scripts/grafana-server/tmp-gma EXTRA_CUSTOM_INI=scripts/grafana-server/custom-gma-rule-list.ini';

// New-list projects, defined only when GMA_RULE_LIST_SERVER is set. They match the `gma-*` specs and
// the corpus setup/teardown, none of which the default `alerting` project runs.
const gmaRuleListProjects: Project[] = [
  // Admin-authenticated journeys. Role-specific ones (RBAC-V/RBAC-E) run only under their own
  // projects below, matched by the `*.viewer.spec.ts`/`*.editor.spec.ts` filename convention;
  // without the ignores, this project would also run them as Admin and they would fail. The two
  // corpus-browsing specs and the corpus setup/teardown specs run only under
  // `alerting-corpus-tests` and its dependencies: running them here too would seed and tear down
  // a 240-rule fixture with no consuming test in between.
  withAuth({
    name: 'alerting-gma',
    testDir: path.join(testDirRoot, '/alerting-suite'),
    testMatch: ['gma-*.spec.ts'],
    testIgnore: [
      /\.viewer\.spec\.ts$/,
      /\.editor\.spec\.ts$/,
      'gma-alert-browsing.spec.ts',
      'gma-recording-browsing.spec.ts',
    ],
  }),
  // Folder and rules the Viewer journey reads (see alerting-suite/viewer-fixtures/). They are seeded
  // by an Admin setup project that the Viewer's login depends on: a basic role's permissions are
  // cached for 60 s across all its users, so a folder created after the Viewer's first request
  // would stay invisible to it until the cache refreshes.
  withAuth({
    name: 'alerting-viewer-fixtures-setup',
    testDir: path.join(testDirRoot, '/alerting-suite/viewer-fixtures'),
    testMatch: ['viewer-fixtures-setup.spec.ts'],
    timeout: 60_000,
  }),
  // Logs in a Viewer dedicated to the alerting suite (the org-wide `viewer` project belongs to
  // plugin API tests), after the fixtures exist. Its storage state is `playwright/.auth/alerting-viewer.json`.
  {
    name: 'alerting-viewer-login',
    testDir: `${dirname(require.resolve('@grafana/plugin-e2e'))}/auth`,
    testMatch: [/.*\.js/],
    use: {
      user: {
        user: 'alerting-viewer',
        password: 'password',
        role: 'Viewer',
      },
    },
    dependencies: ['alerting-viewer-fixtures-setup'],
  },
  // Dedicated Viewer/Editor role journeys for the alerting suite: RBAC-V/RBAC-E use their own
  // users and projects.
  {
    name: 'alerting-viewer',
    testDir: path.join(testDirRoot, '/alerting-suite'),
    testMatch: [/\.viewer\.spec\.ts$/],
    use: {
      ...devices['Desktop Chrome'],
      storageState: 'playwright/.auth/alerting-viewer.json',
    },
    dependencies: ['alerting-viewer-login'],
  },
  // Teardown depends on the Viewer project, like the corpus's, so running it gives the full
  // setup, login, tests, teardown chain.
  withAuth({
    name: 'alerting-viewer-fixtures-teardown',
    testDir: path.join(testDirRoot, '/alerting-suite/viewer-fixtures'),
    testMatch: ['viewer-fixtures-teardown.spec.ts'],
    dependencies: ['alerting-viewer'],
  }),
  {
    name: 'alerting-editor',
    testDir: path.join(testDirRoot, '/alerting-suite'),
    testMatch: [/\.editor\.spec\.ts$/],
    use: {
      ...devices['Desktop Chrome'],
      storageState: 'playwright/.auth/editor.json',
    },
    dependencies: ['createEditorAndAuthenticate'],
  },
  // Once-per-run shared Alert/Recording rule corpus (see alerting-suite/corpus/), run as a
  // setup-project dependency rather than `beforeAll` in a fully-parallel spec. Only the
  // browsing specs that need it depend on it, via `alerting-corpus-tests` below.
  withAuth({
    name: 'alerting-corpus-setup',
    testDir: path.join(testDirRoot, '/alerting-suite/corpus'),
    testMatch: ['corpus-setup.spec.ts'],
    timeout: 180_000,
  }),
  // Browsing journeys that read the corpus manifest. Teardown depends on
  // this project, not directly on setup, so running `alerting-corpus-teardown` gives the full
  // setup, tests, teardown chain without seeding a second corpus on top of the first.
  withAuth({
    name: 'alerting-corpus-tests',
    testDir: path.join(testDirRoot, '/alerting-suite'),
    testMatch: ['gma-alert-browsing.spec.ts', 'gma-recording-browsing.spec.ts'],
    dependencies: ['alerting-corpus-setup'],
    timeout: 180_000,
  }),
  withAuth({
    name: 'alerting-corpus-teardown',
    testDir: path.join(testDirRoot, '/alerting-suite/corpus'),
    testMatch: ['corpus-teardown.spec.ts'],
    dependencies: ['alerting-corpus-tests'],
    timeout: 180_000,
  }),
];

export default defineConfig<PluginOptions>({
  ...baseConfig,
  use: {
    ...baseConfig.use,
    baseURL: process.env.GRAFANA_URL ?? serverUrl,
  },
  ...(!process.env.GRAFANA_URL && {
    webServer: {
      command: gmaRuleListServer
        ? `npm run e2e:plugin:build && ${gmaRuleListServerEnv} ./e2e-playwright/start-server`
        : 'npm run e2e:plugin:build && ./e2e-playwright/start-server',
      url: serverUrl,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  }),
  projects: [
    // Login to Grafana with admin user and store the cookie on disk for use in other tests
    {
      name: 'authenticate',
      testDir: `${dirname(require.resolve('@grafana/plugin-e2e'))}/auth`,
      testMatch: [/.*\.js/],
    },
    // Login to Grafana with new user with viewer role and store the cookie on disk for use in other tests
    {
      name: 'createUserAndAuthenticate',
      testDir: `${dirname(require.resolve('@grafana/plugin-e2e'))}/auth`,
      testMatch: [/.*\.js/],
      use: {
        user: {
          user: 'viewer',
          password: 'password',
          role: 'Viewer',
        },
      },
    },
    // Login to Grafana with new user with editor role and store the cookie on disk for use in
    // other tests — the alerting suite's own Editor journeys, distinct from the Viewer project
    // above (owned by plugin API tests) and from the org-wide `viewer`/`admin` projects.
    {
      name: 'createEditorAndAuthenticate',
      testDir: `${dirname(require.resolve('@grafana/plugin-e2e'))}/auth`,
      testMatch: [/.*\.js/],
      use: {
        user: {
          user: 'editor',
          password: 'password',
          role: 'Editor',
        },
      },
    },
    // Run all tests in parallel using user with admin role
    withAuth({
      name: 'admin',
      testDir: path.join(pluginDirRoot, '/plugin-e2e-api-tests/as-admin-user'),
    }),
    // Run all tests in parallel using user with viewer role
    {
      name: 'viewer',
      testDir: path.join(pluginDirRoot, '/plugin-e2e-api-tests/as-viewer-user'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/viewer.json',
      },
      dependencies: ['createUserAndAuthenticate'],
    },
    withAuth({
      name: 'mysql',
      testDir: path.join(pluginDirRoot, '/mysql'),
    }),
    withAuth({
      name: 'extensions-test-app',
      testDir: path.join(testDirRoot, '/test-plugins/grafana-extensionstest-app'),
    }),
    // Baseline (MT flags off); the MT variant is a separate project below. Both toggle the same
    // fixture, so they must not run concurrently — the MT project depends on this one to serialize.
    withAuth({
      name: 'grafana-e2etest-app',
      testDir: path.join(testDirRoot, '/test-plugins/grafana-test-app'),
      testIgnore: /useMTPlugins/,
    }),
    withAuth({
      name: 'grafana-e2etest-app-mt',
      testDir: path.join(testDirRoot, '/test-plugins/grafana-test-app/tests/useMTPlugins'),
      // Runs only after grafana-e2etest-app finishes, so the two never toggle the fixture at once.
      dependencies: ['grafana-e2etest-app'],
    }),
    withAuth({
      name: 'grafana-e2etest-datasource',
      testDir: path.join(testDirRoot, '/test-plugins/grafana-test-datasource'),
    }),
    withAuth({
      name: 'azuremonitor',
      testDir: path.join(pluginDirRoot, '/azuremonitor'),
    }),
    withAuth({
      name: 'graphite',
      testDir: path.join(pluginDirRoot, '/graphite'),
    }),
    withAuth({
      name: 'influxdb',
      testDir: path.join(pluginDirRoot, '/influxdb'),
    }),
    withAuth({
      name: 'canvas',
      testDir: path.join(testDirRoot, '/canvas'),
    }),
    {
      name: 'unauthenticated',
      testDir: path.join(testDirRoot, '/unauthenticated'),
    },
    withAuth({
      name: 'various',
      testDir: path.join(testDirRoot, '/various-suite'),
    }),
    withAuth({
      name: 'panels',
      testDir: path.join(testDirRoot, '/panels-suite'),
    }),
    withAuth({
      name: 'smoke',
      testDir: path.join(testDirRoot, '/smoke-tests-suite'),
    }),
    withAuth({
      name: 'dashboards',
      testDir: path.join(testDirRoot, '/dashboards-suite'),
    }),
    withAuth({
      name: 'notebooks',
      testDir: path.join(testDirRoot, '/notebooks-suite'),
    }),
    withAuth({
      name: 'diagnostics',
      testDir: path.join(testDirRoot, '/diagnostics-suite'),
    }),
    withAuth({
      name: 'cloud-plugins',
      testDir: path.join(testDirRoot, '/cloud-plugins-suite'),
    }),
    withAuth({
      name: 'alerting',
      testDir: path.join(testDirRoot, '/alerting-suite'),
      // The new-list specs (`gma-*` and the corpus setup/teardown) need the second server and run
      // under the `alerting-gma` family of projects when GMA_RULE_LIST_SERVER is set.
      testIgnore: [/\/gma-[^/]*\.spec\.ts$/, 'corpus/**', 'viewer-fixtures/**'],
    }),
    withAuth({
      name: 'dashboard-new-layouts',
      testDir: path.join(testDirRoot, '/dashboard-new-layouts'),
    }),
    // Setup project for dashboard CUJS tests
    withAuth({
      name: 'dashboard-cujs-setup',
      testDir: path.join(testDirRoot, '/dashboard-cujs'),
      testMatch: ['global-setup.spec.ts'],
    }),
    // Main dashboard CUJS tests
    withAuth({
      name: 'dashboard-cujs',
      testDir: path.join(testDirRoot, '/dashboard-cujs'),
      testIgnore: ['global-setup.spec.ts', 'global-teardown.spec.ts'],
      dependencies: ['dashboard-cujs-setup'],
    }),
    // Teardown project for dashboard CUJS tests
    withAuth({
      name: 'dashboard-cujs-teardown',
      testDir: path.join(testDirRoot, '/dashboard-cujs'),
      testMatch: ['global-teardown.spec.ts'],
      dependencies: ['dashboard-cujs'],
    }),
    withAuth({
      name: 'journey-tracking',
      testDir: path.join(testDirRoot, '/journey-tracking'),
      use: {
        openFeature: {
          flags: {
            cujTracking: true,
          },
        },
      },
    }),
    withAuth({
      name: 'grafana-e2etest-panel',
      testDir: path.join(testDirRoot, '/test-plugins/grafana-test-panel'),
    }),
    // Install/uninstall real catalog plugins; longer timeout since installs download the package.
    withAuth({
      name: 'plugin-catalog',
      testDir: path.join(testDirRoot, '/plugin-catalog-suite/tests'),
      testIgnore: /useMTPlugins/,
      timeout: 60_000,
    }),
    withAuth({
      name: 'plugin-catalog-mt',
      testDir: path.join(testDirRoot, '/plugin-catalog-suite/tests/useMTPlugins'),
      timeout: 60_000,
      // Runs only after plugin-catalog finishes, so the two never install/uninstall at the same time.
      dependencies: ['plugin-catalog'],
    }),
    ...(gmaRuleListServer ? gmaRuleListProjects : []),
  ],
});
