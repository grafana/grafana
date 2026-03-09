import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    reporters: ['verbose'],
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**'],
    setupFiles: ['vitest.setup.ts'],
    env: {
      TZ: 'Pacific/Easter',
    },
  },
  resolve: {
    conditions: ['@grafana-app/source', 'import', 'module', 'default'],
  },
  plugins: [tsconfigPaths()],
});
