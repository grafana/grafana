import { defineConfig } from '@playwright/test';

// Throwaway harness for #135474. Runs against the already-running dev server on :3000.
export default defineConfig({
  testDir: '.',
  timeout: 0,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: process.env.GRAFANA_URL ?? 'http://localhost:3000',
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: Number(process.env.PERF_DPR ?? 1),
    headless: process.env.PERF_HEADED !== '1',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    launchOptions: {
      // Without these, headless Chromium falls back to SwiftShader and WebGL markers run on the CPU
      args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--disable-renderer-backgrounding'],
    },
  },
});
