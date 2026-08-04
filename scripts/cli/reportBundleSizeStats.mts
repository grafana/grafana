import { readFile, stat } from 'fs/promises';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const REPO_ROOT = path.resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BUILD_DIR = path.join(REPO_ROOT, 'public', 'build');

/**
 * The two production builds we emit. The names are used as the metric prefix.
 */
const MANIFESTS = [
  { name: 'default', fileName: 'assets-manifest.json' },
  { name: 'react19', fileName: 'assets-manifest-react19.json' },
];

interface Entrypoint {
  assets: Record<string, string[]>;
}

for (const manifest of MANIFESTS) {
  const entrypoints = await readEntrypoints(path.join(BUILD_DIR, manifest.fileName));

  for (const [entrypointName, entrypoint] of Object.entries(entrypoints)) {
    for (const [assetType, assets] of Object.entries(entrypoint.assets)) {
      // Entrypoints share assets (the webpack runtime, vendor chunks), so these sizes overlap
      const size = await totalSize(new Set(assets));

      logStat(`${manifest.name}.entrypoints.${entrypointName}.${assetType}`, size);
    }
  }
}

async function readEntrypoints(manifestPath: string): Promise<Record<string, Entrypoint>> {
  let contents;
  try {
    contents = await readFile(manifestPath, 'utf8');
  } catch (err) {
    throw new Error(`Could not read ${manifestPath}. Run 'pnpm run build' first.`, { cause: err });
  }

  return JSON.parse(contents).entrypoints;
}

/**
 * Asset paths in the manifest include the webpack publicPath (public/build/), which makes them
 * relative to the repo root.
 */
async function totalSize(assetPaths: Iterable<string>) {
  let size = 0;

  for (const assetPath of assetPaths) {
    const stats = await stat(path.join(REPO_ROOT, assetPath));
    size += stats.size;
  }

  return size;
}

function logStat(name: string, value: string | number) {
  // Note that this output format must match the parsing in ci-frontend-metrics.sh
  // which expects the two values to be separated by a space
  console.log(`${name} ${value}`);
}
