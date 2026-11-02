export interface ChunkGraph {
  chunks: Array<{
    initial: boolean;
    modules: number[];
    assets: string[];
  }>;
  assets: Asset[];
  entrypoints: Array<{
    name: string;
    assets: string[];
  }>;
}

interface Asset {
  path: string;
  size: number;
  gzipSize?: number;
}

export function getChunkMetrics(chunkGraph: ChunkGraph): Record<string, number> {
  const { chunks, assets, entrypoints } = readChunkGraph(chunkGraph);
  const assetsByPath = new Map<string, Asset>();
  for (const asset of assets) {
    if (assetsByPath.has(asset.path)) {
      throw new Error(`Duplicate Rsdoctor asset path: ${asset.path}`);
    }
    assetsByPath.set(asset.path, asset);
  }

  const metrics: Record<string, number> = {
    initialChunks: 0,
    asyncChunks: 0,
    largestAsyncJsBytes: 0,
  };

  for (const chunk of chunks) {
    if (chunk.initial) {
      metrics.initialChunks++;
      continue;
    }

    metrics.asyncChunks++;
    metrics.largestAsyncJsBytes = Math.max(
      metrics.largestAsyncJsBytes,
      totalAssets(chunk.assets, 'js', assetsByPath).bytes
    );
  }

  for (const entrypoint of entrypoints) {
    const js = totalAssets(entrypoint.assets, 'js', assetsByPath);
    const css = totalAssets(entrypoint.assets, 'css', assetsByPath);

    metrics[`entrypoints.${entrypoint.name}.js.bytes`] = js.bytes;
    if (js.gzipBytes !== undefined) {
      metrics[`entrypoints.${entrypoint.name}.js.gzipBytes`] = js.gzipBytes;
    }
    metrics[`entrypoints.${entrypoint.name}.css.bytes`] = css.bytes;
    if (css.gzipBytes !== undefined) {
      metrics[`entrypoints.${entrypoint.name}.css.gzipBytes`] = css.gzipBytes;
    }
  }

  return metrics;
}

function readChunkGraph(graph: ChunkGraph): ChunkGraph {
  if (
    typeof graph !== 'object' ||
    graph === null ||
    !Array.isArray(graph.chunks) ||
    !Array.isArray(graph.assets) ||
    !Array.isArray(graph.entrypoints)
  ) {
    throw new Error('Invalid Rsdoctor chunk graph');
  }

  const entrypointNames = new Set<string>();
  for (const chunk of graph.chunks) {
    if (
      typeof chunk !== 'object' ||
      chunk === null ||
      typeof chunk.initial !== 'boolean' ||
      !isIntegerArray(chunk.modules) ||
      !isStringArray(chunk.assets)
    ) {
      throw new Error('Invalid Rsdoctor chunk');
    }
  }
  for (const asset of graph.assets) {
    if (
      typeof asset !== 'object' ||
      asset === null ||
      typeof asset.path !== 'string' ||
      !isByteCount(asset.size) ||
      (asset.gzipSize !== undefined && !isByteCount(asset.gzipSize))
    ) {
      throw new Error('Invalid Rsdoctor asset');
    }
  }
  for (const entrypoint of graph.entrypoints) {
    if (
      typeof entrypoint !== 'object' ||
      entrypoint === null ||
      typeof entrypoint.name !== 'string' ||
      !isStringArray(entrypoint.assets)
    ) {
      throw new Error('Invalid Rsdoctor entrypoint');
    }
    if (entrypointNames.has(entrypoint.name)) {
      throw new Error(`Duplicate Rsdoctor entrypoint: ${entrypoint.name}`);
    }
    entrypointNames.add(entrypoint.name);
  }

  return graph;
}

function totalAssets(assetPaths: string[], type: 'js' | 'css', assetsByPath: Map<string, Asset>) {
  let bytes = 0;
  let gzipBytes = 0;
  let hasUnavailableGzip = false;

  for (const assetPath of new Set(assetPaths)) {
    const asset = assetsByPath.get(assetPath);
    if (asset === undefined) {
      throw new Error(`Missing Rsdoctor asset: ${assetPath}`);
    }
    if (!asset.path.endsWith(`.${type}`)) {
      continue;
    }

    bytes += asset.size;
    if (asset.gzipSize === undefined) {
      hasUnavailableGzip = true;
    } else {
      gzipBytes += asset.gzipSize;
    }
  }

  return { bytes, gzipBytes: hasUnavailableGzip ? undefined : gzipBytes };
}

function isIntegerArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(Number.isInteger);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isByteCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
