import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-playwright/dashboards-suite',
  testMatch: 'dashboard-lazy-loading.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: 'lazy-review-report', open: 'never' }]],
  outputDir: 'lazy-review-results',
  use: {
    actionTimeout: 10_000,
    permissions: ['clipboard-read', 'clipboard-write'],
    baseURL: 'http://127.0.0.1:3017',
    viewport: { width: 1600, height: 1000 },
    trace: 'on',
    screenshot: 'only-on-failure',
  },
});
