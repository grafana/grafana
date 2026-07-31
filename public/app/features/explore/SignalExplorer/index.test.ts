import * as signalExplorer from './index';
import type { MetricCatalog, MetricRow, MetricType } from './index';

/**
 * The barrel is the surface the sidebar UI builds on, and the UI lives in a different directory — so
 * without this file, dropping an export or renaming one breaks nobody's build until it breaks
 * theirs. These assertions are the contract: adding to the list is a decision, removing from it is a
 * breaking change, and either way it happens on purpose.
 */
describe('signalExplorer public surface', () => {
  it('exports exactly the published values', () => {
    expect(Object.keys(signalExplorer).sort()).toEqual([
      'INITIAL_BATCH',
      'deriveMetricType',
      'dsKey',
      'invalidateMetricCache',
      'rangeKey',
      'useLabelValues',
      'useMetricCatalog',
      'useMetricDetail',
      'useVisibleBatch',
    ]);
  });

  it('exports every helper and hook as a function', () => {
    for (const name of [
      'deriveMetricType',
      'dsKey',
      'invalidateMetricCache',
      'rangeKey',
      'useLabelValues',
      'useMetricCatalog',
      'useMetricDetail',
      'useVisibleBatch',
    ] as const) {
      expect(typeof signalExplorer[name]).toBe('function');
    }
  });

  // Nothing here may reach Explore's store: a caller passes the datasource and range it means, which
  // is what keeps a Mixed pane's cards from resolving each other's datasource.
  it('publishes no reducer, actions or selectors', () => {
    const names = Object.keys(signalExplorer);

    expect(names.filter((name) => name.startsWith('select'))).toEqual([]);
    expect(names.filter((name) => name.endsWith('Reducer'))).toEqual([]);
  });

  it('exports a batch size for the lists that need one', () => {
    expect(signalExplorer.INITIAL_BATCH).toBeGreaterThan(0);
    expect(Number.isInteger(signalExplorer.INITIAL_BATCH)).toBe(true);
  });

  it('derives a metric type from its metadata', () => {
    expect(signalExplorer.deriveMetricType('http_requests_total', { type: 'counter' })).toBe('counter');
  });
});

/**
 * The published types, referenced so that removing one from the barrel fails `yarn typecheck`. A type
 * export leaves nothing behind at runtime, so no assertion above can see it go.
 */
export type PublishedTypes = [MetricCatalog, MetricRow, MetricType];
