import resolve from '@rollup/plugin-node-resolve';
import glob from 'glob';
import { fileURLToPath } from 'node:url';
import path from 'path';
import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import { externals } from 'rollup-plugin-node-externals';

const pkg = require('./package.json');

export default [
  {
    input: 'src/index.ts',
    plugins: [externals({ deps: true, packagePath: './package.json' }), resolve(), esbuild()],
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
        // @ts-expect-error (TS cannot assure that `process.env.PROJECT_CWD` is a string)
        preserveModulesRoot: path.join(process.env.PROJECT_CWD, `packages/grafana-schema/src`),
      },
    ],
  },
  {
    input: './dist/esm/index.d.ts',
    plugins: [dts()],
    output: {
      file: pkg.publishConfig.types,
      format: 'es',
    },
  },
  {
    input: Object.fromEntries(
      glob
        .sync('src/raw/composable/**/*.ts')
        .map((file) => [
          path.relative('src', file.slice(0, file.length - path.extname(file).length)),
          fileURLToPath(new URL(file, import.meta.url)),
        ])
    ),
    plugins: [resolve(), esbuild()],
    output: {
      format: 'esm',
      dir: path.dirname(pkg.publishConfig.module),
    },
  },
];
