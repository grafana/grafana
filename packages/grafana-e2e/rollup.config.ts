import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';
import sourceMaps from 'rollup-plugin-sourcemaps';
import { terser } from 'rollup-plugin-terser';

const { name } = require('./package.json');

const buildCjsPackage = ({ env }) => ({
  input: 'compiled/index.js',
  output: {
    file: `dist/index.${env}.js`,
    name,
    format: 'cjs',
    sourcemap: true,
    exports: 'named',
    globals: {},
  },
  external: ['@grafana/e2e-selectors'],
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
    commonjs({
      include: /node_modules/,
    }),
    resolve(),
    sourceMaps(),
    env === 'production' && terser(),
  ],
});

export default [buildCjsPackage({ env: 'development' }), buildCjsPackage({ env: 'production' })];
