import { defineConfig, devices } from '@playwright/test';
import path, { dirname } from 'path';

import { PluginOptions } from '@grafana/plugin-e2e';

const testDirRoot = 'e2e/plugin-e2e/';
const e2eDirRoot = 'e2e/';

export default defineConfig<PluginOptions>({
  fullyParallel: true,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `http://${process.env.HOST || 'localhost'}:${process.env.PORT || 3000}`,
    trace: 'retain-on-failure',
    httpCredentials: {
      username: 'admin',
      password: 'admin',
    },
    provisioningRootDir: path.join(process.cwd(), process.env.PROV_DIR ?? 'conf/provisioning'),
  },
  projects: [
    // Login to Grafana with admin user and store the cookie on disk for use in other tests
    {
      name: 'plugin-e2e-authenticate',
      testDir: `${dirname(require.resolve('@grafana/plugin-e2e'))}/auth`,
      testMatch: [/.*\.js/],
    },
    // Login to Grafana with new user with viewer role and store the cookie on disk for use in other tests
    {
      name: 'plugin-e2e-createUserAndAuthenticate',
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
      name: 'plugin-e2e-admin',
      testDir: path.join(testDirRoot, '/plugin-e2e-api-tests/as-admin-user'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['plugin-e2e-authenticate'],
    },
    // Run all tests in parallel using user with viewer role
    {
      name: 'plugin-e2e-viewer',
      testDir: path.join(testDirRoot, '/plugin-e2e-api-tests/as-viewer-user'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/viewer.json',
      },
      dependencies: ['plugin-e2e-createUserAndAuthenticate'],
    },
    {
      name: 'plugin-e2e-mysql',
      testDir: path.join(testDirRoot, '/mysql'),
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['plugin-e2e-authenticate'],
    },
    {
      name: 'e2e-authentication',
      testDir: path.join(e2eDirRoot, '/authentication'),
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
