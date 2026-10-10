import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const PUBLIC_PATH = 'public/build/';
const MANIFEST_FILE_NAME = 'assets-manifest.json';

interface Entrypoint {
  assets: Record<string, string[]>;
}

interface BundleManifest {
  entrypoints: Record<string, Entrypoint | boolean>;
}

export async function readBundleSizes(buildDirectory: string): Promise<Record<string, number>> {
  const manifestPath = path.join(buildDirectory, MANIFEST_FILE_NAME);
  const data = await readManifest(manifestPath);
  if (typeof data.entrypoints !== 'object' || data.entrypoints === null || Array.isArray(data.entrypoints)) {
    throw new Error(`Invalid entrypoints in ${manifestPath}`);
  }

  const sizes: Record<string, number> = {};
  for (const [entrypointName, entrypoint] of Object.entries(data.entrypoints)) {
    // esModule describes the output format, not an entrypoint.
    if (entrypointName === 'esModule') {
      continue;
    }
    if (typeof entrypoint !== 'object' || entrypoint === null) {
      throw new Error(`Invalid entrypoint ${entrypointName} in ${manifestPath}`);
    }
    for (const [assetType, assets] of Object.entries(entrypoint.assets)) {
      sizes[`default.entrypoints.${entrypointName}.${assetType}`] = await totalSize(buildDirectory, new Set(assets));
    }
  }

  return sizes;
}

async function readManifest(manifestPath: string): Promise<BundleManifest> {
  let contents: string;
  try {
    contents = await readFile(manifestPath, 'utf8');
  } catch (error) {
    throw new Error(`Could not read ${manifestPath}. Run 'yarn build' first.`, { cause: error });
  }

  return JSON.parse(contents);
}

async function totalSize(buildDirectory: string, assetPaths: Iterable<string>): Promise<number> {
  let size = 0;

  for (const assetPath of assetPaths) {
    size += (await stat(path.join(buildDirectory, stripPublicPath(assetPath)))).size;
  }

  return size;
}

function stripPublicPath(assetPath: string): string {
  return assetPath.startsWith(PUBLIC_PATH) ? assetPath.slice(PUBLIC_PATH.length) : assetPath;
}
