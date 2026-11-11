export interface Summary {
  costs: Array<{ name: string; costs: number }>;
}

export interface LoaderResource {
  loaders: Array<{ startAt: number; endAt: number }>;
}

export interface Diagnostic {
  code: string;
  level: string;
}

export function getCompileMetrics(summary: Summary): Record<string, number> {
  const costs = readCosts(summary);
  const compile = costs.find((cost) => cost.name === 'beforeCompile->afterCompile');

  // Nested hooks (including processAssets) are cumulative and must not be added to this wall-time phase.
  return compile === undefined ? {} : { compileMs: Math.round(compile.costs) };
}

export function getLoaderMetrics(resources: LoaderResource[]): Record<string, number> {
  if (!Array.isArray(resources)) {
    throw new Error('Invalid Rsdoctor loader resources');
  }

  let invocations = 0;
  let cumulativeMs = 0;
  for (const resource of resources) {
    if (typeof resource !== 'object' || resource === null || !Array.isArray(resource.loaders)) {
      throw new Error('Invalid Rsdoctor loader resource');
    }

    for (const loader of resource.loaders) {
      if (
        typeof loader !== 'object' ||
        loader === null ||
        !isDuration(loader.startAt) ||
        !isDuration(loader.endAt) ||
        loader.endAt < loader.startAt
      ) {
        throw new Error('Invalid Rsdoctor loader duration');
      }
      invocations++;
      // Loader executions can overlap; this is their cumulative timing, not build wall time.
      cumulativeMs += loader.endAt - loader.startAt;
    }
  }

  return { loaderInvocations: invocations, loaderCumulativeMs: Math.round(cumulativeMs) };
}

export function getWarningMetrics(diagnostics: Diagnostic[]): Record<string, number> {
  if (!Array.isArray(diagnostics)) {
    throw new Error('Invalid Rsdoctor diagnostics');
  }

  let compilerWarnings = 0;
  let rsdoctorWarnings = 0;
  for (const diagnostic of diagnostics) {
    if (
      typeof diagnostic !== 'object' ||
      diagnostic === null ||
      typeof diagnostic.code !== 'string' ||
      typeof diagnostic.level !== 'string'
    ) {
      throw new Error('Invalid Rsdoctor diagnostic');
    }
    if (diagnostic.level !== 'warn') {
      continue;
    }

    // OVERLAY is Rsdoctor's compiler-diagnostic code; rules may share the same category.
    if (diagnostic.code === 'OVERLAY') {
      compilerWarnings++;
    } else {
      rsdoctorWarnings++;
    }
  }

  return { compilerWarnings, rsdoctorWarnings };
}

function readCosts(summary: Summary): Array<{ name: string; costs: number }> {
  if (typeof summary !== 'object' || summary === null || !Array.isArray(summary.costs)) {
    throw new Error('Invalid Rsdoctor summary');
  }

  for (const cost of summary.costs) {
    if (typeof cost !== 'object' || cost === null || typeof cost.name !== 'string' || !isDuration(cost.costs)) {
      throw new Error('Invalid Rsdoctor compile duration');
    }
  }
  return summary.costs;
}

function isDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
