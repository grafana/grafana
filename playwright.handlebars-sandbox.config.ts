import { defineConfig } from '@playwright/test';

const browsers: Array<'chromium' | 'firefox' | 'webkit'> = ['chromium', 'firefox', 'webkit'];

// This browser-only CSP test suite serves its own response fixtures; it needs no Grafana server.
export default defineConfig({
  testDir: './e2e-playwright/panels-suite',
  testMatch: 'text-handlebars-sandbox.spec.ts',
  outputDir: './test-results/handlebars-sandbox',
  workers: 3,
  retries: 0,
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
  projects: browsers.map((name) => ({
    name,
    use: { browserName: name },
  })),
});
