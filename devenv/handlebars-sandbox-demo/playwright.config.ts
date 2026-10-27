import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'demo.spec.ts',
  outputDir: '../../data/handlebars-sandbox-demo/test-results',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.GRAFANA_URL || 'http://localhost:3011',
    viewport: { width: 1500, height: 1100 },
    trace: 'retain-on-failure',
  },
});
