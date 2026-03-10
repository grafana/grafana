import path from 'node:path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    reporters: ['verbose'],
    css: false,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**'],
    setupFiles: ['vitest.setup.ts', 'vitest-canvas-mock'],
  },
  resolve: {
    conditions: ['@grafana-app/source', 'import', 'module', 'default'],
    alias: [
      // Since `@grafana/plugin-ui` declares `"type": "module"`, when Vitest loads it, all downstream imports are resolved using ESM rules.
      // When `@grafana/plugin-ui/dist/esm/components/QueryEditor/types.js` does `import '@react-awesome-query-builder/ui'`, Node resolves that via the package's `"import"` export condition to `esm/index.js`.
      // That file's extensionless relative imports then fail.
      // Therefore we use the cjs path instead
      {
        find: '@grafana/plugin-ui',
        replacement: path.resolve(import.meta.dirname, '../../node_modules/@grafana/plugin-ui/dist/cjs/index.cjs'),
      },
      {
        find: 'react-inlinesvg',
        replacement: path.resolve(import.meta.dirname, '../../public/test/mocks/react-inlinesvg.tsx'),
      },
    ],
  },
  plugins: [tsconfigPaths()],
});
