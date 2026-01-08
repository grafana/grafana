import { defineConfig, devices } from '@playwright/test';
import path from 'path';

import { PluginOptions } from '@grafana/plugin-e2e';

const testDirRoot = 'e2e-playwright';

export default defineConfig<PluginOptions>({
  fullyParallel: true,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:9001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'yarn storybook',
    url: 'http://localhost:9001',
    stdout: 'ignore',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'storybook',
      testDir: path.join(testDirRoot, '/storybook'),
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
