import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const PUBLIC_PATH = 'public/build/';
const MANIFESTS = [{ name: 'default', fileName: 'assets-manifest.json' }];

interface Entrypoint {
  assets: Record<string, string[]>;
}

interface BundleManifest {
  entrypoints: Record<string, Entrypoint>;
}

export async function readBundleSizes(buildDirectory: string): Promise<Record<string, number>> {
  const sizes: Record<string, number> = {};

  for (const manifest of MANIFESTS) {
    const entrypoints = await readEntrypoints(path.join(buildDirectory, manifest.fileName));

    for (const [entrypointName, entrypoint] of Object.entries(entrypoints)) {
      for (const [assetType, assets] of Object.entries(entrypoint.assets)) {
        sizes[`${manifest.name}.entrypoints.${entrypointName}.${assetType}`] = await totalSize(
          buildDirectory,
          new Set(assets)
        );
      }
    }
  }

  return sizes;
}

async function readEntrypoints(manifestPath: string): Promise<Record<string, Entrypoint>> {
  let contents: string;
  try {
    contents = await readFile(manifestPath, 'utf8');
  } catch (error) {
    throw new Error(`Could not read ${manifestPath}. Run 'yarn build' first.`, { cause: error });
  }

  const manifest: BundleManifest = JSON.parse(contents);
  return manifest.entrypoints;
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
