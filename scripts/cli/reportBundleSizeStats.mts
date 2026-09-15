import { readFile, stat } from 'fs/promises';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const REPO_ROOT = path.resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The publicPath every manifest value is prefixed with. Bundlers share one URL space, so this stays
 * the same even when a build writes its output somewhere other than public/build.
 */
const PUBLIC_PATH = 'public/build/';

/**
 * Where the build wrote its output, relative to the repo root. Pass a different directory to measure
 * a build that does not write to public/build, e.g. `yarn bundle-size:stats public/build-rspack`.
 */
const BUILD_DIR = path.resolve(REPO_ROOT, process.argv[2] || 'public/build');

/**
 * The production builds we emit. The names are used as the metric prefix.
 */
const MANIFESTS = [{ name: 'default', fileName: 'assets-manifest.json' }];

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
    throw new Error(`Could not read ${manifestPath}. Run 'yarn build' first.`, { cause: err });
  }

  return JSON.parse(contents).entrypoints;
}

/**
 * Manifest values are URLs, not disk paths. Strip the publicPath prefix so each asset resolves
 * inside the build directory, wherever that build happened to write it.
 */
async function totalSize(assetPaths: Iterable<string>) {
  let size = 0;

  for (const assetPath of assetPaths) {
    const stats = await stat(path.join(BUILD_DIR, stripPublicPath(assetPath)));
    size += stats.size;
  }

  return size;
}

function stripPublicPath(assetPath: string) {
  return assetPath.startsWith(PUBLIC_PATH) ? assetPath.slice(PUBLIC_PATH.length) : assetPath;
}

function logStat(name: string, value: string | number) {
  // Note that this output format must match the parsing in ci-frontend-metrics.sh
  // which expects the two values to be separated by a space
  console.log(`${name} ${value}`);
}
