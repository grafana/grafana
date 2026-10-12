import path, { basename } from 'node:path';
import { inflateSync } from 'node:zlib';

import { type ChunkGraph, getChunkMetrics } from './chunks.mts';
import { readOptionalJson, readOptionalFile } from './fs.mts';
import { type ModuleGraph, getModuleMetrics, getDependencyMetrics } from './modules.mts';
import {
  type Summary,
  type LoaderResource,
  type Diagnostic,
  getCompileMetrics,
  getLoaderMetrics,
  getWarningMetrics,
} from './profiling.mts';

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

  const metrics: Record<string, number> = {};
  const chunkGraph = await readReportField<ChunkGraph>(profileDirectory, manifest.data, 'chunkGraph');
  if (chunkGraph !== undefined) {
    Object.assign(metrics, getChunkMetrics(chunkGraph));
  }

  const moduleGraph = await readReportField<ModuleGraph>(profileDirectory, manifest.data, 'moduleGraph');
  if (moduleGraph !== undefined) {
    Object.assign(metrics, getDependencyMetrics(moduleGraph));
    if (chunkGraph !== undefined) {
      Object.assign(metrics, getModuleMetrics(chunkGraph, moduleGraph));
    }
  }

  const summary = await readReportField<Summary>(profileDirectory, manifest.data, 'summary');
  if (summary !== undefined) {
    Object.assign(metrics, getCompileMetrics(summary));
  }

  const loader = await readReportField<LoaderResource[]>(profileDirectory, manifest.data, 'loader');
  if (loader !== undefined) {
    Object.assign(metrics, getLoaderMetrics(loader));
  }

  const errors = await readReportField<Diagnostic[]>(profileDirectory, manifest.data, 'errors');
  if (errors !== undefined) {
    Object.assign(metrics, getWarningMetrics(errors));
  }

  return metrics;
}

async function readReportField<T>(
  profileDirectory: string,
  data: Record<string, unknown>,
  field: 'chunkGraph' | 'moduleGraph' | 'summary' | 'loader' | 'errors'
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
