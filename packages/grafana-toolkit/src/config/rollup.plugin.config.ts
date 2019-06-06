// @ts-ignore
import resolve from 'rollup-plugin-node-resolve';
// @ts-ignore
import commonjs from 'rollup-plugin-commonjs';
// @ts-ignore
import sourceMaps from 'rollup-plugin-sourcemaps';
// @ts-ignore
import typescript from 'rollup-plugin-typescript2';
// @ts-ignore
import json from 'rollup-plugin-json';
// @ts-ignore
import copy from 'rollup-plugin-copy-glob';
// @ts-ignore
import { terser } from 'rollup-plugin-terser';
// @ts-ignore
import visualizer from 'rollup-plugin-visualizer';

// @ts-ignore
const replace = require('replace-in-file');
const pkg = require(`${process.cwd()}/package.json`);
const { PRODUCTION } = process.env;

export const outputOptions = {
  dir: 'dist',
  format: 'cjs',
  sourcemap: true,
  chunkFileNames: '[name].js',
};
export const inputOptions = {
  input: [
    'src/module.ts', // app
    'src/datasource/module.ts',
    'src/panels/events/module.ts',
    'src/panels/presense/module.ts',
  ],

  manualChunks(id: string) {
    // id == absolute path
    if (id.endsWith('module.ts')) {
      const idx = id.indexOf('/src/');
      if (idx > 0) {
        const p = id.substring(idx + 5, id.lastIndexOf('.'));
        console.log('MODULE:', id, p);
        return p;
      }
    }
    console.log('shared:', id);
    return 'shared';
  },
  external: [
    'jquery', // exported by grafana
    'lodash', // exported by grafana
    'moment', // exported by grafana
    'rxjs', // exported by grafana
    'd3', // exported by grafana
    'react', // exported by grafana
    'react-dom', // exported by grafana
    '@grafana/ui', // exported by grafana
    '@grafana/runtime', // exported by grafana
    '@grafana/data', // exported by grafana,
  ],
  watch: {
    include: 'src/**',
  },
  plugins: [
    // Allow json resolution
    json(),

    // Compile TypeScript files
    typescript({
      useTsconfigDeclarationDir: true,
      typescript: require('typescript'),
      objectHashIgnoreUnknownHack: true,
    }),

    // Allow bundling cjs modules (unlike webpack, rollup doesn't understand cjs)
    commonjs(),

    // Allow node_modules resolution, so you can use 'external' to control
    // which external modules to include in the bundle
    // https://github.com/rollup/rollup-plugin-node-resolve#usage
    resolve(),

    // Resolve source maps to the original source
    sourceMaps(),

    // Minify
    PRODUCTION && terser(),

    // Copy files
    copy([{ files: 'src/**/*.{json,svg,png,html}', dest: 'dist' }], { verbose: true }),

    // Help avoid including things accidentally
    visualizer({
      filename: 'dist/stats.html',
      title: 'Plugin Stats',
    }),

    // Custom callback when we are done
    finish(),
  ],
};

function finish() {
  return {
    name: 'finish',
    buildEnd() {
      const files = 'dist/plugin.json';
      replace.sync({
        files: files,
        from: /%VERSION%/g,
        to: pkg.version,
      });
      replace.sync({
        files: files,
        from: /%TODAY%/g,
        to: new Date().toISOString().substring(0, 10),
      });

      if (PRODUCTION) {
        console.log('*minified*');
      }
    },
  };
}
