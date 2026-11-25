import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { InputOptions, OutputOptions, RolldownOptions } from 'rolldown';
import { dts, type Options as DtsOptions } from 'rolldown-plugin-dts';

const projectRootCwd = '../../';
const customSourceCondition = '@grafana-app/source';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parsePackage(pkg: unknown): { name: string; exports: Record<string, unknown> } {
  if (!isRecord(pkg) || typeof pkg.name !== 'string' || pkg.name === '') {
    throw new Error(`${process.cwd()}/package.json has no "name" field.`);
  }
  const exports = isRecord(pkg.exports) ? pkg.exports : {};
  return { name: pkg.name, exports };
}

const { name: packageName, exports: exportsMap } = parsePackage(JSON.parse(readFileSync('package.json', 'utf8')));

// rolldown-plugin-dts only emits declarations for entries, so every published subpath must be an entry.
function publishedEntries(): string[] {
  return Object.values(exportsMap).flatMap((target) => {
    if (!isRecord(target)) {
      return [];
    }
    const source = target[customSourceCondition];
    const isPublished = Object.keys(target).some((condition) => condition !== customSourceCondition);
    if (typeof source !== 'string' || !isPublished) {
      return [];
    }
    const sources = source.includes('*') ? globSync(source).map((file) => `./${file}`) : [source];
    return sources.filter((file) => /\.tsx?$/.test(file));
  });
}

// Bare imports stay external so the declaration build doesn't inline types from undeclared dependencies.
// JS self-imports are bundled from source to become relative imports. Declaration self-imports stay bare
// because inlining a namespace self-import leaks an internal export into the entry's public types.
function isExternal(id: string, importer: string | undefined): boolean {
  const isBare = /^[^./\0]/.test(id);
  const isSelf = id === packageName || id.startsWith(`${packageName}/`);
  const isDeclaration = importer !== undefined && /\.d\.[cm]?ts$/.test(importer);
  const isJsSelfImport = isSelf && !isDeclaration;
  return isBare && !isJsSelfImport;
}

// Use TS7 for emitting declarations.
const dtsOptions: DtsOptions = {
  tsconfig: 'tsconfig.build.json',
  generator: 'tsgo',
  tsgo: { path: resolve(projectRootCwd, 'node_modules/@typescript/native/bin/tsc') },
};

const sharedOutput: OutputOptions = {
  preserveModules: true,
  preserveModulesRoot: resolve('src'),
  sourcemap: true,
};

// rolldown-plugin-dts only emits declarations from ESM output, so .d.cts needs its own declaration-only build.
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
    resolve: { conditionNames: [customSourceCondition, 'import', 'default'] },
    // Historically warnings resulted in broken code that still builds (e.g. import.meta in CJS).
    onLog(level, log, defaultHandler) {
      defaultHandler(level === 'warn' ? 'error' : level, log);
    },
    // Declaration generation is always the slowest plugin, so the warning is noise.
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
