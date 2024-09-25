import resolve from '@rollup/plugin-node-resolve';
import path from 'path';
import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import { nodeExternals } from 'rollup-plugin-node-externals';

import pkg from './package.json';

export default [
  {
    input: 'src/index.ts',
    plugins: [nodeExternals({ deps: true, packagePath: './package.json' }), resolve(), esbuild()],
    output: [
      {
        format: 'esm',
        sourcemap: true,
        dir: path.dirname(pkg.publishConfig.main),
        preserveModules: true,
      },
    ],
  },
  {
    input: 'src/index.ts',
    plugins: [dts()],
    output: {
      file: pkg.publishConfig.types,
      format: 'es',
    },
  },
];
