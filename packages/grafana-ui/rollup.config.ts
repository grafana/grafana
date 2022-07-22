import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import svg from 'rollup-plugin-svg-import';
import { terser } from 'rollup-plugin-terser';

const pkg = require('./package.json');

const libraryName = pkg.name;

const buildCjsPackage = ({ env }) => {
  return {
    input: `compiled/index.js`,
    output: [
      {
        dir: 'dist',
        name: libraryName,
        format: 'cjs',
        sourcemap: true,
        strict: false,
        exports: 'named',
        chunkFileNames: `[name].${env}.js`,
        globals: {
          react: 'React',
          'prop-types': 'PropTypes',
        },
      },
    ],
    external: [
      'react',
      'react-dom',
      '@grafana/data',
      '@grafana/schema',
      '@grafana/e2e-selectors',
      'moment',
      'jquery', // required to use jquery.plot, which is assigned externally
      'react-inlinesvg', // required to mock Icon svg loading in tests
      '@emotion/react',
      '@emotion/css',
    ],
    plugins: [
      // rc-time-picker has a transitive dependency on component-indexof which
      // when bundled via `component-classes` imports a nonexistent `indexof` module.
      alias({ entries: [{ find: 'indexof', replacement: 'component-indexof' }] }),
      commonjs({
        include: /node_modules/,
        ignoreTryCatch: false,
      }),
      resolve(),
      svg({ stringify: true }),
      env === 'production' && terser(),
    ],
  };
};
export default [buildCjsPackage({ env: 'development' }), buildCjsPackage({ env: 'production' })];
