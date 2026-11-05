import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getDependencyMetrics, getModuleMetrics } from './modules.mts';

describe('module metrics', () => {
  it('counts nested concatenated leaves once across initial and async chunks', () => {
    const metrics = getModuleMetrics(
      {
        chunks: [
          { initial: false, modules: [20], assets: [] },
          { initial: true, modules: [10], assets: [] },
        ],
        assets: [],
        entrypoints: [],
      },
      {
        modules: [
          { id: 1, kind: 0 },
          { id: 2, kind: 0 },
          { id: 3, kind: 0 },
          { id: 4, kind: 0 },
          { id: 10, kind: 1, modules: [11, 1] },
          { id: 11, kind: 1, modules: [1, 2] },
          { id: 20, kind: 1, modules: [2, 3] },
        ],
        dependencies: [],
      }
    );

    assert.deepEqual(metrics, {
      initialModules: 2,
      totalModules: 3,
      asyncOnlyModules: 1,
    });
  });

  it('reports zero initial modules when valid chunks are all async', () => {
    const metrics = getModuleMetrics(
      {
        chunks: [{ initial: false, modules: [1], assets: [] }],
        assets: [],
        entrypoints: [],
      },
      {
        modules: [{ id: 1, kind: 0 }],
        dependencies: [],
      }
    );

    assert.deepEqual(metrics, {
      initialModules: 0,
      totalModules: 1,
      asyncOnlyModules: 1,
    });
  });

  it('rejects a module ID referenced by a chunk but missing from the graph', () => {
    assert.throws(() =>
      getModuleMetrics(
        {
          chunks: [{ initial: false, modules: [42], assets: [] }],
          assets: [],
          entrypoints: [],
        },
        { modules: [], dependencies: [] }
      )
    );
  });

  it('counts every dependency edge by its dependency kind', () => {
    const metrics = getDependencyMetrics({
      modules: [],
      dependencies: [{ kind: 1 }, { kind: 1 }, { kind: 2 }, { kind: 3 }, { kind: 4 }, { kind: 0 }, { kind: 99 }],
    });

    assert.deepEqual(metrics, {
      'dependencies.staticImports': 2,
      'dependencies.dynamicImports': 1,
      'dependencies.requireCalls': 1,
      'dependencies.amdRequires': 1,
      'dependencies.unknown': 2,
    });
  });
});
