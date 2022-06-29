import resolve from '@rollup/plugin-node-resolve';
import path from 'path';
import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import { externals } from 'rollup-plugin-node-externals';

const pkg = require('./package.json');

const bundle = (config) => ({
  input: 'src/index.ts',
  plugins: [externals({ deps: true, packagePath: './package.json' }), resolve(), esbuild()],
  ...config,
});

export default [
  bundle({
    output: [
      {
        format: 'cjs',
        sourcemap: true,
        dir: path.dirname(pkg.publishConfig.main),
      },
      {
        format: 'esm',
        sourcemap: true,
        dir: path.dirname(pkg.publishConfig.module),
        preserveModules: true,
        // @ts-expect-error
        preserveModulesRoot: path.join(process.env.PROJECT_CWD, `packages/grafana-schema/src`),
      },
    ],
  }),
  bundle({
    input: './compiled/index.d.ts',
    plugins: [dts()],
    output: {
      file: pkg.publishConfig.types,
      format: 'es',
    },
  }),
];
