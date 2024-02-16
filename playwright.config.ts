import { defineConfig, devices } from '@playwright/test';
import path, { dirname } from 'path';

import { PluginOptions } from '@grafana/plugin-e2e';
/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig<PluginOptions>({
  testDir: './plugin-e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: `http://${process.env.HOST || 'localhost'}:${process.env.PORT || 3000}`,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    httpCredentials: {
      username: 'admin',
      password: 'admin',
    },
    provisioningRootDir: path.join(process.cwd(), 'conf/provisioning'),
  },

  /* Configure projects for major browsers */
  projects: [
    // 1. Login to Grafana and store the cookie on disk for use in subsequent test projects.
    {
      name: 'authenticate',
      testDir: `${dirname(require.resolve('@grafana/plugin-e2e'))}/auth`,
      testMatch: [/.*\.js/],
    },
    // 2. Run all tests in parallel using Chrome.
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['authenticate'],
    },
  ],
});
