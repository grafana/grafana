import path from 'node:path';
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
    setupFiles: ['vitest.setup.ts', 'vitest-canvas-mock'],
    testTimeout: 30_000,
  },
  resolve: {
    conditions: ['@grafana-app/source', 'import', 'module', 'default'],
    alias: [
      { find: 'react-inlinesvg', replacement: path.resolve(__dirname, '../../public/test/mocks/react-inlinesvg.tsx') },
      { find: 'uwrap', replacement: 'uwrap/dist/uWrap.mjs' },
    ],
  },
  plugins: [tsconfigPaths()],
});
