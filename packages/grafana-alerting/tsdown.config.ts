import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/testing.ts', 'src/unstable.ts'],
  format: ['cjs', 'esm'],
  platform: 'browser',
  target: 'es2018',
  dts: true,
  sourcemap: true,
  exports: {
    devExports: '@grafana/source',
  },
  attw: true, // check bundles with @arethetypeswrong/cli
  publint: true, // check the package.json file with publint
  hash: false, // this is on by default, turning it off produces nicer file names
});
