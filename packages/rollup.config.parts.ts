// This file contains the common parts of the rollup configuration that are shared across multiple packages.
import nodeResolve from '@rollup/plugin-node-resolve';
import { dirname, resolve } from 'node:path';
import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import { nodeExternals } from 'rollup-plugin-node-externals';

// This is the path to the root of the grafana project
// Prefer PROJECT_CWD env var set by yarn berry
const projectCwd = process.env.PROJECT_CWD ?? '../../';

export const entryPoint = 'src/index.ts';

// Plugins that are shared across all rollup configurations. Their order can affect build output.
// Externalising and resolving modules should happen before transformation.
export const plugins = [
  nodeExternals({ deps: true, packagePath: './package.json' }),
  nodeResolve(),
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
    preserveModules: true,
    preserveModulesRoot: resolve(projectCwd, `packages/${pkgName}/src`),
  };
}

// Generate a rollup configuration for rolling up typescript declaration files into a single file.
export function tsDeclarationOutput(pkg, overrides = {}) {
  return {
    input: './compiled/index.d.ts',
    plugins: [dts()],
    output: {
      file: pkg.publishConfig.types,
      format: 'es',
    },
    ...overrides,
  };
}
