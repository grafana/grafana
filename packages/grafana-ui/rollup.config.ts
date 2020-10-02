import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import image from '@rollup/plugin-image';
// import sourceMaps from 'rollup-plugin-sourcemaps';
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
      '@grafana/e2e-selectors',
      'moment',
      'monaco-editor', // Monaco should not be used directly
      'monaco-editor/esm/vs/editor/editor.api', // Monaco should not be used directly
      'react-monaco-editor',
      'jquery', // required to use jquery.plot, which is assigned externally
    ],
    plugins: [
      commonjs({
        include: /node_modules/,
        // When 'rollup-plugin-commonjs' fails to properly convert the CommonJS modules to ES6 one has to manually name the exports
        // https://github.com/rollup/rollup-plugin-commonjs#custom-named-exports
        namedExports: {
          '../../node_modules/lodash/lodash.js': [
            'flatten',
            'find',
            'upperFirst',
            'debounce',
            'isNil',
            'isNumber',
            'flattenDeep',
            'map',
            'chunk',
            'sortBy',
            'uniqueId',
            'zip',
            'omit',
            'isString',
            'isEmpty',
            'toLower',
          ],
          '../../node_modules/react-color/lib/components/common': ['Saturation', 'Hue', 'Alpha'],
          '../../node_modules/immutable/dist/immutable.js': [
            'Record',
            'Set',
            'Map',
            'List',
            'OrderedSet',
            'is',
            'Stack',
          ],
          'node_modules/immutable/dist/immutable.js': ['Record', 'Set', 'Map', 'List', 'OrderedSet', 'is', 'Stack'],
          '../../node_modules/esrever/esrever.js': ['reverse'],
          '../../node_modules/react-table/index.js': [
            'useTable',
            'useSortBy',
            'useBlockLayout',
            'Cell',
            'useResizeColumns',
            'useAbsoluteLayout',
            'useFilters',
          ],
          '../../node_modules/react-is/index.js': ['isValidElementType', 'isContextConsumer'],
        },
      }),
      resolve(),
      // sourceMaps(),
      image(),
      env === 'production' && terser(),
    ],
  };
};
export default [buildCjsPackage({ env: 'development' }), buildCjsPackage({ env: 'production' })];
