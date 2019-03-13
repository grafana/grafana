import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
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
        globals: {
          react: 'React',
          'prop-types': 'PropTypes',
        },
      },
    ],
    external: ['react', 'react-dom'],
    plugins: [
      commonjs({
        include: /node_modules/,
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
          ],
          '../../node_modules/react-color/lib/components/common': ['Saturation', 'Hue', 'Alpha'],
        },
      }),
      resolve(),
      sourceMaps(),
      env === 'production' && terser(),
    ],
  };
};
export default [buildCjsPackage({ env: 'development' }), buildCjsPackage({ env: 'production' })];
