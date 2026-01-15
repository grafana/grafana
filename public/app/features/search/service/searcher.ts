import { config } from '@grafana/runtime';

import { SQLSearcher } from './sql';
import { GrafanaSearcher } from './types';
import { UnifiedSearcher } from './unified';

let searcher: GrafanaSearcher | undefined = undefined;

export function getGrafanaSearcher(): GrafanaSearcher {
  if (!searcher) {
    const sqlSearcher = new SQLSearcher();
    const useUnifiedStorageSearch =
      config.featureToggles.unifiedStorageSearchUI || config.featureToggles.panelTitleSearch;
    searcher = useUnifiedStorageSearch ? new UnifiedSearcher(sqlSearcher) : sqlSearcher;
  }
  return searcher!;
}

/**
 * Testing only - otherwise tests will use the same searcher instance, making it hard to test unified search vs legacy
 * @deprecated Don't use this other than in tests!
 */
export function resetGrafanaSearcher() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('resetGrafanaSearcher can only be used in tests');
  }
  searcher = undefined;
}
