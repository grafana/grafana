import { config } from '@grafana/runtime';

import { BlugeSearcher } from './bluge';
import { BlugeSearcherWithFallback } from './blugeWithFallback';
import { SQLSearcher } from './sql';
import { GrafanaSearcher } from './types';

let searcher: GrafanaSearcher | undefined = undefined;

export function getGrafanaSearcher(): GrafanaSearcher {
  if (!searcher) {
    const useBluge = config.featureToggles.panelTitleSearch;
    const sqlSearcher = new SQLSearcher();

    if (useBluge) {
      searcher = new BlugeSearcherWithFallback({
        blugeSearcher: new BlugeSearcher(),
        sqlSearcher,
      });
    } else {
      searcher = sqlSearcher;
    }
  }
  return searcher!;
}
