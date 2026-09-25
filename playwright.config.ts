import { defineConfig, devices, type PlaywrightTestConfig, type Project } from '@playwright/test';
import path, { dirname } from 'path';

import { type PluginOptions } from '@grafana/plugin-e2e';

export const testDirRoot = 'e2e-playwright';
const pluginDirRoot = path.join(testDirRoot, 'plugin-e2e');
export const DEFAULT_URL = 'http://localhost:3001';

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

export default defineConfig<PluginOptions>({
  ...baseConfig,
  ...(!process.env.GRAFANA_URL && {
    webServer: {
      command: 'yarn e2e:plugin:build && ./e2e-playwright/start-server',
      url: DEFAULT_URL,
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
      name: 'cloudwatch',
      testDir: path.join(pluginDirRoot, '/cloudwatch'),
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
    }),
    // Dedicated Viewer/Editor role journeys for the alerting suite — the org-wide `viewer`
    // project belongs to plugin API tests, not alerting, so RBAC-V/RBAC-E use their own.
    {
      name: 'alerting-viewer',
      testDir: path.join(testDirRoot, '/alerting-suite'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/viewer.json',
      },
      dependencies: ['createUserAndAuthenticate'],
    },
    {
      name: 'alerting-editor',
      testDir: path.join(testDirRoot, '/alerting-suite'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/editor.json',
      },
      dependencies: ['createEditorAndAuthenticate'],
    },
    // Once-per-run shared Alert/Recording rule corpus (see alerting-suite/corpus/), run as a
    // setup-project dependency rather than `beforeAll` in a fully-parallel spec. Not wired as a
    // dependency of the `alerting` project above — only specs that actually browse the corpus
    // should pay its setup cost; add `alerting-corpus-setup` to such a spec's own dependencies.
    withAuth({
      name: 'alerting-corpus-setup',
      testDir: path.join(testDirRoot, '/alerting-suite/corpus'),
      testMatch: ['corpus-setup.spec.ts'],
      timeout: 180_000,
    }),
    withAuth({
      name: 'alerting-corpus-teardown',
      testDir: path.join(testDirRoot, '/alerting-suite/corpus'),
      testMatch: ['corpus-teardown.spec.ts'],
      dependencies: ['alerting-corpus-setup'],
      timeout: 180_000,
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
        featureToggles: {
          cujTracking: true,
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
  ],
});
