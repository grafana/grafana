import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getChunkMetrics } from './chunks.mts';

describe('getChunkMetrics', () => {
  it('deduplicates entrypoint assets, keeps shared assets per entrypoint, and filters asset types', () => {
    const metrics = getChunkMetrics({
      chunks: [
        { initial: true, modules: [], assets: ['app.js', 'theme.css'], size: 999999 },
        {
          initial: false,
          modules: [],
          assets: ['async-a.js', 'async-a.js', 'app.js', 'theme.css', 'app.js.map'],
          size: 999999,
        },
        { initial: false, modules: [], assets: ['async-b.js'], parsedSize: 888888 },
      ],
      assets: [
        { path: 'app.js', size: 10 },
        { path: 'shared.js', size: 7, gzipSize: 0 },
        { path: 'theme.css', size: 4, gzipSize: 0 },
        { path: 'app.js.map', size: 100, gzipSize: 50 },
        { path: 'NOTICE', size: 100, gzipSize: 50 },
        { path: 'async-a.js', size: 12, gzipSize: 6 },
        { path: 'async-b.js', size: 20, gzipSize: 8 },
      ],
      entrypoints: [
        { name: 'app', assets: ['app.js', 'app.js', 'shared.js', 'theme.css', 'app.js.map', 'NOTICE'] },
        { name: 'admin', assets: ['shared.js', 'shared.js'] },
      ],
    });

    assert.deepEqual(metrics, {
      initialChunks: 1,
      asyncChunks: 2,
      largestAsyncJsBytes: 22,
      'entrypoints.app.js.bytes': 17,
      'entrypoints.app.css.bytes': 4,
      'entrypoints.app.css.gzipBytes': 0,
      'entrypoints.admin.js.bytes': 7,
      'entrypoints.admin.js.gzipBytes': 0,
      'entrypoints.admin.css.bytes': 0,
      'entrypoints.admin.css.gzipBytes': 0,
    });
  });

  it('rejects an asset reference missing from the asset table', () => {
    assert.throws(() =>
      getChunkMetrics({
        chunks: [],
        assets: [],
        entrypoints: [{ name: 'app', assets: ['missing.js'] }],
      })
    );
  });
});
