// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/metrics-modal/uFuzzy.ts
import uFuzzy from '@leeoniya/ufuzzy';

const uf = new uFuzzy({
  intraMode: 1,
  intraIns: 1,
  intraSub: 1,
  intraTrn: 1,
  intraDel: 1,
});

export const fuzzySearch = (haystack: string[], query: string) => {
  const [idxs, info, order] = uf.search(haystack, query, 0, 1e5);

  let haystackOrder: string[] = [];
  let matchesSet: Set<string> = new Set();
  if (!(idxs && order)) {
    return [[], []];
  }
  /**
   * get the fuzzy matches for highlighting
   * @param part
   * @param matched
   */
  const mark = (part: string, matched: boolean) => {
    if (matched) {
      matchesSet.add(part);
    }
  };

  // Iterate to create the order of needles(queries) and the matches
  for (let i = 0; i < order.length; i++) {
    let infoIdx = order[i];

    /** Evaluate the match, get the matches for highlighting */
    uFuzzy.highlight(haystack[info.idx[infoIdx]], info.ranges[infoIdx], mark);
    /** Get the order */
    haystackOrder.push(haystack[info.idx[infoIdx]]);
  }

  return [haystackOrder, [...matchesSet]];
};
