interface Chunk {
  initial: boolean;
  modules: number[];
}

interface Module {
  id: number;
  kind: 0 | 1;
  modules?: number[];
}

export interface ChunkGraph {
  chunks: Chunk[];
}

export interface ModuleGraph {
  modules: Module[];
}

export function countInitialModules(chunkGraph: ChunkGraph, moduleGraph: ModuleGraph): number {
  const chunks = readChunks(chunkGraph);
  const modules = readModules(moduleGraph);
  const initialModuleIds = chunks.filter((chunk) => chunk.initial).flatMap((chunk) => chunk.modules);
  const moduleIds = new Set<number>();
  const visited = new Set<number>();

  for (const moduleId of initialModuleIds) {
    collectInitialModules(moduleId, modules, visited, moduleIds);
  }

  return moduleIds.size;
}

function readChunks(graph: ChunkGraph): Chunk[] {
  if (typeof graph !== 'object' || graph === null || !Array.isArray(graph.chunks)) {
    throw new Error('Invalid Rsdoctor chunk graph');
  }

  return graph.chunks.map((chunk) => {
    if (
      typeof chunk !== 'object' ||
      chunk === null ||
      typeof chunk.initial !== 'boolean' ||
      !isModuleIds(chunk.modules)
    ) {
      throw new Error('Invalid Rsdoctor chunk');
    }
    return chunk;
  });
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

function collectInitialModules(
  moduleId: number,
  modules: Map<number, Module>,
  visited: Set<number>,
  moduleIds: Set<number>
) {
  if (visited.has(moduleId)) {
    return;
  }
  visited.add(moduleId);

  const module = modules.get(moduleId);
  if (module === undefined) {
    throw new Error(`Missing Rsdoctor module: ${moduleId}`);
  }
  if (module.kind === 0) {
    moduleIds.add(module.id);
    return;
  }
  if (module.modules === undefined) {
    throw new Error(`Missing Rsdoctor concatenated module children: ${module.id}`);
  }

  // Containers can appear alongside their children in chunk.modules, so only count normal modules.
  for (const childId of module.modules) {
    collectInitialModules(childId, modules, visited, moduleIds);
  }
}

function isModuleIds(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((id) => Number.isInteger(id));
}
