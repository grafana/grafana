import { readFileSync } from 'fs';
import path from 'path';

function resolveToMain(packageName: string): string {
  const pkgPath = path.resolve(`node_modules/${packageName}/package.json`);
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return path.resolve(`node_modules/${packageName}`, pkg.main);
}

function resolveExportEntry(entry: unknown): string | null {
  if (typeof entry === 'string') {
    return entry;
  }
  if (typeof entry === 'object' && entry !== null) {
    const obj = entry as Record<string, unknown>;
    return (
      resolveExportEntry(obj['default']) ??
      resolveExportEntry(obj['import']) ??
      resolveExportEntry(obj['require']) ??
      null
    );
  }
  return null;
}

function resolveMsw(subpath = '.'): string {
  const pkgPath = path.resolve('node_modules/msw/package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const exportEntry = pkg.exports?.[subpath];
  const entry = resolveExportEntry(exportEntry);
  if (!entry) {
    throw new Error(`Cannot resolve msw${subpath === '.' ? '' : subpath} entry`);
  }
  return path.resolve('node_modules/msw', entry);
}

export function jestStyleResolverPlugin() {
  return {
    name: 'jest-style-resolver',
    enforce: 'pre' as const,
    resolveId(source: string) {
      // Bypass exports map for these packages — mirrors what jest-resolver.js did
      // by deleting pkg.exports, forcing resolution to pkg.main (Node CJS build)
      // if (source.startsWith('@mswjs/interceptors')) {
      //   return resolveToMain('@mswjs/interceptors');
      // }
      if (source === 'uuid') {
        return resolveToMain('uuid');
      }
      if (source === 'react-colorful') {
        return resolveToMain('react-colorful');
      }
      // mirrors: delete pkg.exports['./node'].browser for msw
      if (source === 'msw') {
        return resolveMsw('.');
      }
      return null;
    },
  };
}
