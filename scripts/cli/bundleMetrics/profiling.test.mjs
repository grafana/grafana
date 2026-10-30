import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getCompileMetrics, getLoaderMetrics, getWarningMetrics } from './profiling.mts';

describe('profiling metrics', () => {
  it('uses only the exact compile phase', () => {
    assert.deepEqual(
      getCompileMetrics({
        costs: [
          { name: 'beforeCompile->afterCompile', costs: 12.6 },
          { name: 'bootstrap->beforeCompile', costs: 2 },
          { name: 'afterCompile->done', costs: 3 },
          { name: 'minify(processAssets)', costs: 9 },
        ],
      }),
      { compileMs: 13 }
    );
  });

  it('omits compile timing when the exact phase is absent', () => {
    assert.deepEqual(getCompileMetrics({ costs: [{ name: 'afterCompile->done', costs: 10 }] }), {});
  });

  it('counts overlapping loader durations and rounds their total once', () => {
    assert.deepEqual(
      getLoaderMetrics([{ loaders: [{ startAt: 1.1, endAt: 2.4 }] }, { loaders: [{ startAt: 2, endAt: 3.4 }] }]),
      { loaderInvocations: 2, loaderCumulativeMs: 3 }
    );
  });

  it('rejects invalid observed durations', () => {
    assert.throws(() => getCompileMetrics({ costs: [{ name: 'beforeCompile->afterCompile', costs: -1 }] }));
    assert.throws(() => getLoaderMetrics([{ loaders: [{ startAt: 2, endAt: 1 }] }]));
  });

  it('separates compiler and Rsdoctor warnings while ignoring other levels', () => {
    assert.deepEqual(
      getWarningMetrics([
        { code: 'OVERLAY', level: 'warn', category: 'bundle' },
        { code: 'RULE_ASSET_SIZE', level: 'warn', category: 'bundle' },
        { code: 'OVERLAY', level: 'error' },
        { code: 'RULE_DUPLICATE', level: 'info' },
      ]),
      { compilerWarnings: 1, rsdoctorWarnings: 1 }
    );
  });

  it('reports zero counters for empty loader and diagnostic collections', () => {
    assert.deepEqual(getLoaderMetrics([]), { loaderInvocations: 0, loaderCumulativeMs: 0 });
    assert.deepEqual(getWarningMetrics([]), { compilerWarnings: 0, rsdoctorWarnings: 0 });
  });
});
