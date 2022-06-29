// import commonjs from '@rollup/plugin-commonjs';
// import resolve from '@rollup/plugin-node-resolve';
// import copy from 'rollup-plugin-copy';
// import sourceMaps from 'rollup-plugin-sourcemaps';
// import { terser } from 'rollup-plugin-terser';

// const { name } = require('./package.json');

// const buildCjsPackage = ({ env }) => ({
//   input: 'compiled/index.js',
//   output: {
//     file: `dist/index.${env}.js`,
//     name,
//     format: 'cjs',
//     sourcemap: true,
//     exports: 'named',
//     globals: {},
//   },
//   external: ['@grafana/e2e-selectors'],
//   plugins: [
// copy({
//   flatten: false,
//   targets: [
//     { src: 'bin/**/*.*', dest: 'dist/bin/' },
//     { src: 'cli.js', dest: 'dist/' },
//     { src: 'cypress.json', dest: 'dist/' },
//     { src: 'cypress/**/*.*', dest: 'dist/cypress/' },
//   ],
// }),
//     commonjs({
//       include: /node_modules/,
//     }),
//     resolve(),
//     sourceMaps(),
//     env === 'production' && terser(),
//   ],
// });

// export default [buildCjsPackage({ env: 'development' }), buildCjsPackage({ env: 'production' })];

import resolve from '@rollup/plugin-node-resolve';
import path from 'path';
import copy from 'rollup-plugin-copy';
import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import { externals } from 'rollup-plugin-node-externals';

const pkg = require('./package.json');

const bundle = (config) => ({
  input: 'src/index.ts',
  plugins: [
    copy({
      flatten: false,
      targets: [
        { src: 'bin/**/*.*', dest: 'dist/bin/' },
        { src: 'cli.js', dest: 'dist/' },
        { src: 'cypress.json', dest: 'dist/' },
        { src: 'cypress/**/*.*', dest: 'dist/cypress/' },
      ],
    }),
    externals({ deps: true, packagePath: './package.json' }),
    resolve(),
    esbuild({ target: 'node16' }),
  ],
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
