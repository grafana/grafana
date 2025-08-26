import { defineConfig, devices, PlaywrightTestConfig, Project } from '@playwright/test';
import path, { dirname } from 'path';

import { PluginOptions } from '@grafana/plugin-e2e';

const testDirRoot = 'e2e-playwright';
const pluginDirRoot = path.join(testDirRoot, 'plugin-e2e');
const DEFAULT_URL = 'http://localhost:3001';

function withAuth(project: Project): Project {
  project.dependencies ??= [];
  project.use ??= {};

  project.dependencies = project.dependencies.concat('authenticate');
  project.use = {
    ...project.use,
    storageState: `playwright/.auth/${process.env.GRAFANA_ADMIN_USER || 'admin'}.json`,
  };

  return project;
}

export default defineConfig<PluginOptions>({
  fullyParallel: true,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'], // pretty
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
      name: 'elasticsearch',
      testDir: path.join(pluginDirRoot, '/elasticsearch'),
    }),
    withAuth({
      name: 'mysql',
      testDir: path.join(pluginDirRoot, '/mysql'),
    }),
    withAuth({
      name: 'mssql',
      testDir: path.join(pluginDirRoot, '/mssql'),
    }),
    withAuth({
      name: 'extensions-test-app',
      testDir: path.join(testDirRoot, '/test-plugins/grafana-extensionstest-app'),
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
      name: 'cloudmonitoring',
      testDir: path.join(pluginDirRoot, '/cloudmonitoring'),
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
      name: 'opentsdb',
      testDir: path.join(pluginDirRoot, '/opentsdb'),
    }),
    withAuth({
      name: 'jaeger',
      testDir: path.join(pluginDirRoot, '/jaeger'),
    }),
    withAuth({
      name: 'grafana-postgresql-datasource',
      testDir: path.join(pluginDirRoot, '/grafana-postgresql-datasource'),
    }),
    withAuth({
      name: 'canvas',
      testDir: path.join(testDirRoot, '/canvas'),
    }),
    withAuth({
      name: 'zipkin',
      testDir: path.join(pluginDirRoot, '/zipkin'),
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
      name: 'loki',
      testDir: path.join(testDirRoot, '/loki'),
    }),
    withAuth({
      name: 'cloud-plugins',
      testDir: path.join(testDirRoot, '/cloud-plugins-suite'),
    }),
    withAuth({
      name: 'dashboard-new-layouts',
      testDir: path.join(testDirRoot, '/dashboard-new-layouts'),
    }),
  ],
});
