import { babel } from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import path from 'path';
import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import { externals } from 'rollup-plugin-node-externals';
import svg from 'rollup-plugin-svg-import';

const pkg = require('./package.json');

const cwd = process.env.PROJECT_CWD ?? '';

export default [
  {
    input: 'src/index.ts',
    plugins: [
      externals({ deps: true, packagePath: './package.json' }),
      resolve(),
      svg({ stringify: true }),
      babel({
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        babelHelpers: 'bundled',
        plugins: [['@babel/plugin-syntax-typescript', { isTSX: true }], 'macros'],
        babelrc: false,
      }),
      esbuild(),
    ],
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
        preserveModulesRoot: path.join(cwd, `packages/grafana-ui/src`),
      },
    ],
  },
  {
    input: './compiled/index.d.ts',
    plugins: [dts()],
    output: {
      file: pkg.publishConfig.types,
      format: 'es',
    },
  },
];
