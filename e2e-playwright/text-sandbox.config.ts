import { defineConfig } from '@playwright/test';

// These tests exercise browser security enforcement without a running Grafana server.
export default defineConfig({
  testDir: './panels-suite',
  testMatch: 'text-sandbox.spec.ts',
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
