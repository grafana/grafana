/* eslint-disable import/no-extraneous-dependencies */
// This file contains the common parts of the rolldown configuration that are shared across multiple packages.
import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { InputOptions, OutputOptions, RolldownOptions } from 'rolldown';
import { dts, type Options as DtsOptions } from 'rolldown-plugin-dts';
import ts from 'typescript';

// This is the path to the root of the grafana project
// Prefer PROJECT_CWD env var set by yarn berry
const projectCwd = process.env.PROJECT_CWD ?? '../../';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const pkg: unknown = JSON.parse(readFileSync('package.json', 'utf8'));
const packageName = isRecord(pkg) && typeof pkg.name === 'string' ? pkg.name : '';

// Every export that is built for publishing becomes an entry, so each public subpath gets its own JS and
// declaration files. rolldown-plugin-dts only emits declarations for entries and the modules their types reference.
export function publishedEntries(): string[] {
  const exportsMap = isRecord(pkg) && isRecord(pkg.exports) ? pkg.exports : {};

  return Object.values(exportsMap).flatMap((target) => {
    if (!isRecord(target)) {
      return [];
    }
    const source = target['@grafana-app/source'];
    const isPublished = Object.keys(target).some((condition) => condition !== '@grafana-app/source');
    if (typeof source !== 'string' || !isPublished) {
      return [];
    }
    const sources = source.includes('*') ? globSync(source).map((file) => `./${file}`) : [source];
    return sources.filter((file) => /\.tsx?$/.test(file));
  });
}

// Every source module that tsconfig.build.json compiles, so its excludes (tests, stories) still apply.
// The declaration builds use these as entries: for a preserved module that is not an entry, rolldown renames the
// module's own declaration when it clashes with an import (AnnotationQuery becomes AnnotationQuery$1), and
// TypeScript then shows the renamed name in consumers' hovers and errors. For entries it renames the import.
function sourceModules(): string[] {
  const { config } = ts.readConfigFile('tsconfig.build.json', ts.sys.readFile);
  const { fileNames } = ts.parseJsonConfigFileContent(config, ts.sys, resolve('.'));
  const sourceRoot = resolve('src');
  return fileNames.filter((file) => file.startsWith(sourceRoot) && /\.tsx?$/.test(file) && !/\.d\.ts$/.test(file));
}

// Every bare import stays external. Keeping them external also stops the declaration build inlining types
// from dependencies that are undeclared or only referenced through inline import() types. The exception is
// a JS self-import, which resolves to source below so it becomes a relative import instead of a bundled
// copy. Declarations keep self-imports bare, as tsc emits them, because inlining a namespace self-import
// adds an internal export to the entry's public types.
function isExternal(id: string, importer: string | undefined): boolean {
  const isBare = /^[^./\0]/.test(id);
  const isSelf = id === packageName || id.startsWith(`${packageName}/`);
  const isDeclaration = importer !== undefined && /\.d\.[cm]?ts$/.test(importer);
  return isBare && (!isSelf || isDeclaration);
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

// Returns the builds for a package: ESM and CJS JavaScript from the published entries, then declaration-only
// builds for .d.mts and .d.cts from every source module. rolldown-plugin-dts can only emit declarations from ESM
// output, hence the CJS declaration build uses ESM format with .cjs file names.
export function createPackageConfig(options: InputOptions = {}): RolldownOptions[] {
  const { plugins } = options;
  const shared: InputOptions = {
    input: publishedEntries(),
    platform: 'neutral',
    tsconfig: 'tsconfig.build.json',
    transform: { target: 'es2018' },
    // Consumers tree-shake; shaking here drops exports and enum members they rely on.
    treeshake: false,
    external: isExternal,
    resolve: { conditionNames: ['@grafana-app/source', 'import', 'default'] },
    // Warnings have so far meant broken output that still builds (e.g. import.meta in CJS), so fail instead.
    onLog(level, log, defaultHandler) {
      defaultHandler(level === 'warn' ? 'error' : level, log);
    },
    // Declaration generation dominates build time by design, so the slow-plugin warning is noise.
    checks: { pluginTimings: false },
    ...options,
  };
  const declarations: InputOptions = {
    ...shared,
    input: sourceModules(),
    plugins: [plugins, dts({ ...dtsOptions, emitDtsOnly: true })],
  };

  return [
    {
      ...shared,
      output: { ...sharedOutput, format: 'es', dir: 'dist/esm', entryFileNames: '[name].mjs' },
    },
    {
      ...declarations,
      output: { ...sharedOutput, format: 'es', dir: 'dist/esm', entryFileNames: '[name].mjs' },
    },
    {
      ...shared,
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
      ...declarations,
      output: { ...sharedOutput, format: 'es', dir: 'dist/cjs', entryFileNames: '[name].cjs' },
    },
  ];
}
