import { config } from '@grafana/runtime';

import { BlugeSearcher } from './bluge';
import { FrontendSearcher } from './frontend';
import { SQLSearcher } from './sql';
import { GrafanaSearcher } from './types';
import { BleveSearcher } from './bleve';

let searcher: GrafanaSearcher | undefined = undefined;

export function getGrafanaSearcher(): GrafanaSearcher {
  if (!searcher) {
    const sqlSearcher = new SQLSearcher();
    const useBluge = config.featureToggles.panelTitleSearch;
    searcher = useBluge ? new BlugeSearcher(sqlSearcher) : sqlSearcher;

    const useBleve = config.featureToggles.unifiedStorageSearch;
    if (useBleve) {
      searcher = new BleveSearcher(sqlSearcher);
    }

    if (useBluge && location.search.includes('do-frontend-query')) {
      searcher = new FrontendSearcher(searcher);
    }
  }
  return searcher!;
}
