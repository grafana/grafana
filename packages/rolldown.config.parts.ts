/* eslint-disable import/no-extraneous-dependencies */
// This file contains the common parts of the rolldown configuration that are shared across multiple packages.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { InputOptions, OutputOptions, RolldownOptions } from 'rolldown';
import { dts, type Options as DtsOptions } from 'rolldown-plugin-dts';

// This is the path to the root of the grafana project
// Prefer PROJECT_CWD env var set by yarn berry
const projectCwd = process.env.PROJECT_CWD ?? '../../';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Every export that is built for publishing becomes an entry, so each public subpath gets its own JS and
// declaration files. rolldown-plugin-dts only emits declarations for entries and the modules their types reference.
export function publishedEntries(): string[] {
  const pkg: unknown = JSON.parse(readFileSync('package.json', 'utf8'));
  const exportsMap = isRecord(pkg) && isRecord(pkg.exports) ? pkg.exports : {};

  return Object.values(exportsMap).flatMap((target) => {
    if (!isRecord(target)) {
      return [];
    }
    const source = target['@grafana-app/source'];
    const isPublished = Object.keys(target).some((condition) => condition !== '@grafana-app/source');
    if (typeof source !== 'string' || !isPublished || !/\.tsx?$/.test(source)) {
      return [];
    }
    return [source];
  });
}

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
    input: publishedEntries(),
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
    // Declaration generation dominates build time by design, so the slow-plugin warning is noise.
    checks: { pluginTimings: false },
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
