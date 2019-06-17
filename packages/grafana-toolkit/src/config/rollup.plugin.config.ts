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
const path = require('path');
const fs = require('fs');
const tsConfig = require(`${__dirname}/tsconfig.plugin.json`);

const { PRODUCTION } = process.env;

export const outputOptions = {
  dir: 'dist',
  format: 'cjs',
  sourcemap: true,
  chunkFileNames: '[name].js',
};

const findModuleTs = (base: string, files?: string[], result?: string[]) => {
  files = files || fs.readdirSync(base);
  result = result || [];

  if (files) {
    files.forEach(file => {
      const newbase = path.join(base, file);
      if (fs.statSync(newbase).isDirectory()) {
        result = findModuleTs(newbase, fs.readdirSync(newbase), result);
      } else {
        if (file.indexOf('module.ts') > -1) {
          // @ts-ignore
          result.push(newbase);
        }
      }
    });
  }
  return result;
};

const getModuleFiles = () => {
  return findModuleTs(path.resolve(process.cwd(), 'src'));
};

export const inputOptions = () => {
  const inputFiles = getModuleFiles();
  return {
    input: inputFiles,
    manualChunks:
      inputFiles.length > 1
        ? (id: string) => {
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
          }
        : null,
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
        typescript: require('typescript'),
        objectHashIgnoreUnknownHack: true,
        tsconfigDefaults: tsConfig,
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
