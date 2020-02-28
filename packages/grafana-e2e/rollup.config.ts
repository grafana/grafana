import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import copy from 'rollup-plugin-copy';
import sourceMaps from 'rollup-plugin-sourcemaps';
import { terser } from 'rollup-plugin-terser';

const pkg = require('./package.json');

const libraryName = pkg.name;

const buildCjsPackage = ({ env }) => {
  return {
    input: `compiled/index.js`,
    output: [
      {
        file: `dist/index.${env}.js`,
        name: libraryName,
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
        globals: {},
      },
    ],
    plugins: [
      copy({
        flatten: false,
        targets: [
          { src: 'cypress.json', dest: 'dist/' },
          { src: 'cypress/**/*.+(js|ts)', dest: 'dist/cypress/' },
        ],
      }),
      commonjs({
        include: /node_modules/,
      }),
      resolve(),
      sourceMaps(),
      env === 'production' && terser(),
    ],
  };
};
export default [buildCjsPackage({ env: 'development' }), buildCjsPackage({ env: 'production' })];
