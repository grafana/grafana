import { config } from '@grafana/runtime';

import { BlugeSearcher } from './bluge';
import { FrontendSearcher } from './frontend';
import { SQLSearcher } from './sql';
import { GrafanaSearcher } from './types';
import { UnifiedSearcher } from './unified';

let searcher: GrafanaSearcher | undefined = undefined;

export function getGrafanaSearcher(): GrafanaSearcher {
  if (!searcher) {
    const sqlSearcher = new SQLSearcher();

    const useBluge = config.featureToggles.panelTitleSearch;
    searcher = useBluge ? new BlugeSearcher(sqlSearcher) : sqlSearcher;
    if (useBluge && window.location.search.includes('do-frontend-query')) {
      return new FrontendSearcher(searcher);
    }

    const useUnifiedStorageSearch = config.featureToggles.unifiedStorageSearchUI;
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
