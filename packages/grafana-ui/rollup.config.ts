import resolve from '@rollup/plugin-node-resolve';
import path from 'path';
import copy from 'rollup-plugin-copy';
import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import { externals } from 'rollup-plugin-node-externals';
import svg from 'rollup-plugin-svg-import';

const icons = require('../../public/app/core/icons/cached.json');

const pkg = require('./package.json');

const iconSrcPaths = icons.map((iconSubPath) => {
  return `../../public/img/icons/${iconSubPath}.svg`;
});

export default [
  {
    input: 'src/index.ts',
    plugins: [
      externals({ deps: true, packagePath: './package.json' }),
      svg({ stringify: true }),
      resolve(),
      copy({
        targets: [{ src: iconSrcPaths, dest: './dist/public/' }],
        flatten: false,
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
        // @ts-expect-error (TS cannot assure that `process.env.PROJECT_CWD` is a string)
        preserveModulesRoot: path.join(process.env.PROJECT_CWD, `packages/grafana-ui/src`),
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
