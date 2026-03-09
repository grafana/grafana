import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    reporters: ['verbose'],
    css: false, // disables CSS processing entirely in tests
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**'],
    setupFiles: [
      // 'public/test/setup-polyfills.ts', // MUST be first
      // 'vitest-canvas-mock',
      // 'public/test/vitest-setup.ts',
      // 'public/test/setupVitestTests.ts',
    ],
    testTimeout: 30_000,
    env: {
      TZ: 'Pacific/Easter',
    },
  },
  resolve: {
    conditions: ['@grafana-app/source', 'import', 'module', 'default'],
    alias: [],
  },
  plugins: [tsconfigPaths()],
});
