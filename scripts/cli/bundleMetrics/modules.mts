import type { ChunkGraph } from './chunks.mts';

interface Module {
  id: number;
  kind: 0 | 1;
  modules?: number[];
}

interface Dependency {
  kind: number;
}

export interface ModuleGraph {
  modules: Module[];
  dependencies: Dependency[];
}

export function getModuleMetrics(chunkGraph: ChunkGraph, moduleGraph: ModuleGraph): Record<string, number> {
  const chunks = readChunks(chunkGraph);
  const modules = readModules(moduleGraph);
  const visited = new Set<number>();
  let initialModules = 0;
  let totalModules = 0;

  // Visit initial chunks first so shared leaves do not count as async-only modules.
  for (const chunk of chunks) {
    if (chunk.initial) {
      const counts = collectModules(chunk.modules, modules, visited);
      initialModules += counts;
      totalModules += counts;
    }
  }

  for (const chunk of chunks) {
    if (!chunk.initial) {
      totalModules += collectModules(chunk.modules, modules, visited);
    }
  }

  return {
    initialModules,
    totalModules,
    asyncOnlyModules: totalModules - initialModules,
  };
}

export function getDependencyMetrics(moduleGraph: ModuleGraph): Record<string, number> {
  const dependencies = readDependencies(moduleGraph);
  const metrics = {
    'dependencies.staticImports': 0,
    'dependencies.dynamicImports': 0,
    'dependencies.requireCalls': 0,
    'dependencies.amdRequires': 0,
    'dependencies.unknown': 0,
  };

  for (const dependency of dependencies) {
    switch (dependency.kind) {
      case 1:
        metrics['dependencies.staticImports']++;
        break;
      case 2:
        metrics['dependencies.dynamicImports']++;
        break;
      case 3:
        metrics['dependencies.requireCalls']++;
        break;
      case 4:
        metrics['dependencies.amdRequires']++;
        break;
      default:
        metrics['dependencies.unknown']++;
    }
  }

  return metrics;
}

function readChunks(graph: ChunkGraph): ChunkGraph['chunks'] {
  if (typeof graph !== 'object' || graph === null || !Array.isArray(graph.chunks)) {
    throw new Error('Invalid Rsdoctor chunk graph');
  }

  for (const chunk of graph.chunks) {
    if (
      typeof chunk !== 'object' ||
      chunk === null ||
      typeof chunk.initial !== 'boolean' ||
      !isModuleIds(chunk.modules)
    ) {
      throw new Error('Invalid Rsdoctor chunk');
    }
  }

  return graph.chunks;
}

function readModules(graph: ModuleGraph): Map<number, Module> {
  if (typeof graph !== 'object' || graph === null || !Array.isArray(graph.modules)) {
    throw new Error('Invalid Rsdoctor module graph');
  }

  const modules = new Map<number, Module>();
  for (const module of graph.modules) {
    if (
      typeof module !== 'object' ||
      module === null ||
      !Number.isInteger(module.id) ||
      (module.kind !== 0 && module.kind !== 1)
    ) {
      throw new Error('Invalid Rsdoctor module');
    }
    if (module.kind === 1 && !isModuleIds(module.modules)) {
      throw new Error('Invalid Rsdoctor concatenated module');
    }
    if (modules.has(module.id)) {
      throw new Error(`Duplicate Rsdoctor module ID: ${module.id}`);
    }
    modules.set(module.id, module);
  }
  return modules;
}

function readDependencies(graph: ModuleGraph): Dependency[] {
  if (typeof graph !== 'object' || graph === null || !Array.isArray(graph.dependencies)) {
    throw new Error('Invalid Rsdoctor module graph dependencies');
  }

  for (const dependency of graph.dependencies) {
    if (typeof dependency !== 'object' || dependency === null || !Number.isInteger(dependency.kind)) {
      throw new Error('Invalid Rsdoctor dependency');
    }
  }

  return graph.dependencies;
}

function collectModules(moduleIds: number[], modules: Map<number, Module>, visited: Set<number>): number {
  let count = 0;

  for (const moduleId of moduleIds) {
    if (visited.has(moduleId)) {
      continue;
    }
    visited.add(moduleId);

    const module = modules.get(moduleId);
    if (module === undefined) {
      throw new Error(`Missing Rsdoctor module: ${moduleId}`);
    }
    if (module.kind === 0) {
      count++;
      continue;
    }
    if (module.modules === undefined) {
      throw new Error(`Missing Rsdoctor concatenated module children: ${module.id}`);
    }

    count += collectModules(module.modules, modules, visited);
  }

  return count;
}

function isModuleIds(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((id) => Number.isInteger(id));
}
