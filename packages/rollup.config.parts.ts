// This file contains the common parts of the rollup configuration that are shared across multiple packages.
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import { dirname, resolve } from 'node:path';
import esbuild from 'rollup-plugin-esbuild';
import { nodeExternals } from 'rollup-plugin-node-externals';

// This is the path to the root of the grafana project
// Prefer PROJECT_CWD env var set by yarn berry
const projectCwd = process.env.PROJECT_CWD ?? '../../';

export const entryPoint = 'src/index.ts';

// Plugins that are shared across all rollup configurations. Their order can affect build output.
// Externalising and resolving modules should happen before transformation.
export const plugins = [
  nodeExternals({
    deps: true,
    packagePath: './package.json',
  }),
  nodeResolve(),
  json(),
  commonjs({
    // Handle CommonJS modules like moment, papaparse, etc.
    include: /node_modules/,
    transformMixedEsModules: true,
    // Exclude problematic packages from commonjs transformation
    exclude: ['@grafana/scenes', 'react-router-dom'],
  }),
  esbuild({
    target: 'es2018',
    tsconfig: 'tsconfig.build.json',
  }),
];

// Generates a rollup configuration for commonjs output.
export function cjsOutput(pkg) {
  return {
    format: 'cjs',
    sourcemap: true,
    dir: dirname(pkg.publishConfig.main),
    entryFileNames: '[name].cjs',
    esModule: true,
    interop: 'compat',
  };
}

// Generate a rollup configuration for es module output.
export function esmOutput(pkg, pkgName) {
  return {
    format: 'esm',
    sourcemap: true,
    dir: dirname(pkg.publishConfig.module),
    entryFileNames: '[name].mjs',
    preserveModules: true,
    preserveModulesRoot: resolve(projectCwd, `packages/${pkgName}/src`),
  };
}
