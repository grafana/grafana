import { BlugeSearcher } from './bluge';
import { GrafanaSearcher } from './types';

let searcher: GrafanaSearcher | undefined = undefined;

export function getGrafanaSearcher(): GrafanaSearcher {
  if (!searcher) {
    searcher = new BlugeSearcher();
  }
  return searcher!;
}
