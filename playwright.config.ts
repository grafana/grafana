import { defineConfig, devices } from '@playwright/test';
import path, { dirname } from 'path';

import { PluginOptions } from '@grafana/plugin-e2e';

const testDirRoot = 'e2e-playwright';
const pluginDirRoot = path.join(testDirRoot, 'plugin-e2e');
const DEFAULT_URL = 'http://localhost:3001';

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
      // air now deletes the binary, so we check if we need to build it before trying to start the server
      // see https://github.com/air-verse/air/issues/525
      // if this gets resolved, we could remove the go build and rely on the binary being present as before
      command:
        'if [ ! -f ./bin/grafana ]; then make GO_BUILD_DEV=1 build-go-fast; fi && yarn e2e:plugin:build && ./e2e-playwright/start-server',
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
    {
      name: 'admin',
      testDir: path.join(pluginDirRoot, '/plugin-e2e-api-tests/as-admin-user'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
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
    {
      name: 'elasticsearch',
      testDir: path.join(pluginDirRoot, '/elasticsearch'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
    {
      name: 'mysql',
      testDir: path.join(pluginDirRoot, '/mysql'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
    {
      name: 'mssql',
      testDir: path.join(pluginDirRoot, '/mssql'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
    {
      name: 'extensions-test-app',
      testDir: path.join(testDirRoot, '/test-plugins/grafana-extensionstest-app'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
    {
      name: 'grafana-e2etest-datasource',
      testDir: path.join(testDirRoot, '/test-plugins/grafana-test-datasource'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
    {
      name: 'cloudwatch',
      testDir: path.join(pluginDirRoot, '/cloudwatch'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
    {
      name: 'azuremonitor',
      testDir: path.join(pluginDirRoot, '/azuremonitor'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
    {
      name: 'cloudmonitoring',
      testDir: path.join(pluginDirRoot, '/cloudmonitoring'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
    {
      name: 'graphite',
      testDir: path.join(pluginDirRoot, '/graphite'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
    {
      name: 'influxdb',
      testDir: path.join(pluginDirRoot, '/influxdb'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
    {
      name: 'opentsdb',
      testDir: path.join(pluginDirRoot, '/opentsdb'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
    {
      name: 'jaeger',
      testDir: path.join(pluginDirRoot, '/jaeger'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
    {
      name: 'grafana-postgresql-datasource',
      testDir: path.join(pluginDirRoot, '/grafana-postgresql-datasource'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
    {
      name: 'zipkin',
      testDir: path.join(pluginDirRoot, '/zipkin'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
    {
      name: 'unauthenticated',
      testDir: path.join(testDirRoot, '/unauthenticated'),
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'various',
      testDir: path.join(testDirRoot, '/various-suite'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
    {
      name: 'panels',
      testDir: path.join(testDirRoot, '/panels-suite'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
    {
      name: 'smoke',
      testDir: path.join(testDirRoot, '/smoke-tests-suite'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
    {
      name: 'dashboards',
      testDir: path.join(testDirRoot, '/dashboards-suite'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
    {
      name: 'loki',
      testDir: path.join(testDirRoot, '/loki'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
    {
      name: 'cloud-plugins',
      testDir: path.join(testDirRoot, '/cloud-plugins-suite'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
    {
      name: 'dashboard-new-layouts',
      testDir: path.join(testDirRoot, '/dashboard-new-layouts'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
  ],
});
