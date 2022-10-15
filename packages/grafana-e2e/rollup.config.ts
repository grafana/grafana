import resolve from '@rollup/plugin-node-resolve';
import path from 'path';
import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import { externals } from 'rollup-plugin-node-externals';

const pkg = require('./package.json');

export default [
  {
    input: 'src/index.ts',
    plugins: [externals({ deps: true, packagePath: './package.json' }), resolve(), esbuild({ target: 'node16' })],
    output: [
      {
        format: 'cjs',
        sourcemap: true,
        dir: path.dirname(pkg.publishConfig.main),
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
