/* eslint-disable import/no-extraneous-dependencies */
// This file contains the common parts of the rolldown configuration that are shared across multiple packages.
import { resolve } from 'node:path';
import type { InputOptions, OutputOptions, RolldownOptions } from 'rolldown';
import { dts, type Options as DtsOptions } from 'rolldown-plugin-dts';

// This is the path to the root of the grafana project
// Prefer PROJECT_CWD env var set by yarn berry
const projectCwd = process.env.PROJECT_CWD ?? '../../';

export const entryPoint = 'src/index.ts';

// Declarations come from the same native TypeScript 7 compiler used for type checking.
const dtsOptions: DtsOptions = {
  tsconfig: 'tsconfig.build.json',
  generator: 'tsgo',
  tsgo: { path: resolve(projectCwd, 'node_modules/@typescript/native/bin/tsc') },
};

const sharedOutput: OutputOptions = {
  preserveModules: true,
  preserveModulesRoot: resolve('src'),
  sourcemap: true,
};

// Returns the builds for a package: ESM with .d.mts, CJS, then a declaration-only pass for .d.cts.
// rolldown-plugin-dts can only emit declarations from ESM output, hence the separate CJS declaration build.
export function createPackageConfig(options: InputOptions = {}): RolldownOptions[] {
  const { plugins } = options;
  const shared: InputOptions = {
    input: entryPoint,
    platform: 'neutral',
    tsconfig: 'tsconfig.build.json',
    transform: { target: 'es2018' },
    // Consumers tree-shake; shaking here drops exports and enum members they rely on.
    treeshake: false,
    // Every bare import stays external. This also stops the declaration build inlining types from
    // dependencies that are undeclared or only referenced through inline import() types.
    external: /^[^./\0]/,
    // Warnings have so far meant broken output that still builds (e.g. import.meta in CJS), so fail instead.
    onLog(level, log, defaultHandler) {
      defaultHandler(level === 'warn' ? 'error' : level, log);
    },
    ...options,
  };

  return [
    {
      ...shared,
      plugins: [plugins, dts(dtsOptions)],
      output: { ...sharedOutput, format: 'es', dir: 'dist/esm', entryFileNames: '[name].mjs' },
    },
    {
      ...shared,
      plugins,
      output: {
        ...sharedOutput,
        format: 'cjs',
        dir: 'dist/cjs',
        entryFileNames: '[name].cjs',
        esModule: true,
        strict: true,
      },
    },
    {
      ...shared,
      plugins: [plugins, dts({ ...dtsOptions, emitDtsOnly: true })],
      output: { ...sharedOutput, format: 'es', dir: 'dist/cjs', entryFileNames: '[name].cjs' },
    },
  ];
}
