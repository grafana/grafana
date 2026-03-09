import path from 'node:path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

const mockPath = (file: string) => path.resolve(__dirname, '../../public/test/mocks', file);

export default defineConfig({
  test: {
    globals: true,
    reporters: ['verbose'],
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**'],
    setupFiles: ['vitest.setup.ts', 'vitest-canvas-mock'],
  },
  resolve: {
    conditions: ['@grafana-app/source', 'import', 'module', 'default'],
    alias: [{ find: 'react-inlinesvg', replacement: mockPath('react-inlinesvg.tsx') }],
  },
  plugins: [tsconfigPaths()],
});
