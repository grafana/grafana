import path, { basename } from 'node:path';
import { inflateSync } from 'node:zlib';

import { readOptionalJson, readOptionalFile } from './fs.mts';
import { type ChunkGraph, type ModuleGraph, countInitialModules } from './initialModules.mts';

interface Manifest {
  data?: Record<string, unknown>;
}

export async function readRsdoctorMetrics(profileDirectory: string): Promise<Record<string, number>> {
  const manifest = await readOptionalJson<Manifest>(path.join(profileDirectory, 'manifest.json'));
  if (manifest === undefined || manifest.data === undefined) {
    return {};
  }
  if (typeof manifest.data !== 'object' || manifest.data === null || Array.isArray(manifest.data)) {
    throw new Error('Invalid Rsdoctor manifest data');
  }

  const chunkGraph = await readGraph<ChunkGraph>(profileDirectory, manifest.data, 'chunkGraph');
  const moduleGraph = await readGraph<ModuleGraph>(profileDirectory, manifest.data, 'moduleGraph');
  if (chunkGraph === undefined || moduleGraph === undefined) {
    return {};
  }

  return { initialModules: countInitialModules(chunkGraph, moduleGraph) };
}

async function readGraph<T>(
  profileDirectory: string,
  data: Record<string, unknown>,
  field: 'chunkGraph' | 'moduleGraph'
): Promise<T | undefined> {
  const shards = data[field];
  if (shards === undefined) {
    return undefined;
  }
  if (!Array.isArray(shards)) {
    throw new Error(`Invalid Rsdoctor ${field} shard list`);
  }
  if (shards.length === 0) {
    return undefined;
  }
  if (!shards.every((shard) => typeof shard === 'string')) {
    throw new Error(`Invalid Rsdoctor ${field} shard path`);
  }

  const encoded = await Promise.all(
    shards.map(async (shard) => readOptionalFile(path.join(profileDirectory, field, basename(shard))))
  );
  if (encoded.some((shard) => shard === undefined)) {
    return undefined;
  }

  return JSON.parse(inflateSync(Buffer.from(encoded.join(''), 'base64')).toString('utf8'));
}
