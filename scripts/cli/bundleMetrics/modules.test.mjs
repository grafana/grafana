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

  it('attributes initial leaves to feature folders across nested and shared chunks', () => {
    const metrics = getModuleMetrics(
      {
        chunks: [
          { initial: false, modules: [1, 6], assets: [] },
          { initial: true, modules: [10, 3, 4, 5, 7], assets: [] },
          { initial: true, modules: [11, 1], assets: [] },
        ],
        assets: [],
        entrypoints: [],
      },
      {
        modules: [
          { id: 1, kind: 0, path: '/repo/public/app/features/dashboard/state/model.ts', size: { parsedSize: 100 } },
          { id: 2, kind: 0, path: './public/app/features/dashboard/components/Panel.tsx', size: { parsedSize: 200 } },
          {
            id: 3,
            kind: 0,
            path: 'C:\\repo\\public\\app\\features\\explore\\state\\main.ts',
            size: { parsedSize: 50 },
          },
          { id: 4, kind: 0, path: '/repo/public/app/core/features/not-a-feature.ts' },
          { id: 5, kind: 0, path: '/repo/public/app/features/root.ts' },
          { id: 6, kind: 0, path: '/repo/public/app/features/alerting/nested/page.tsx', size: { parsedSize: 900 } },
          { id: 7, kind: 0, path: 'public/app/features/explore/empty.ts', size: { parsedSize: 0 } },
          {
            id: 10,
            kind: 1,
            modules: [11, 1],
            path: '/repo/public/app/features/dashboard/aggregate.ts',
            size: { parsedSize: 9999 },
          },
          { id: 11, kind: 1, modules: [1, 2] },
        ],
        dependencies: [],
      }
    );

    assert.deepEqual(metrics, {
      initialModules: 6,
      totalModules: 7,
      asyncOnlyModules: 1,
      'initialCode.byFolder.public_app_features_dashboard.modules': 2,
      'initialCode.byFolder.public_app_features_dashboard.parsedBytes': 300,
      'initialCode.byFolder.public_app_features_explore.modules': 2,
      'initialCode.byFolder.public_app_features_explore.parsedBytes': 50,
    });
  });

  it('rejects missing or invalid parsed sizes rather than underreporting initial feature sizes', () => {
    for (const parsedSize of [undefined, -1, NaN, Infinity, '100']) {
      assert.throws(
        () =>
          getModuleMetrics(
            {
              chunks: [{ initial: true, modules: [1], assets: [] }],
              assets: [],
              entrypoints: [],
            },
            {
              modules: [{ id: 1, kind: 0, path: '/repo/public/app/features/dashboard/model.ts', size: { parsedSize } }],
              dependencies: [],
            }
          ),
        /Invalid Rsdoctor feature module parsed size: 1/
      );
    }
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
