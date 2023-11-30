import uFuzzy from '@leeoniya/ufuzzy';
import { debounce as debounceLodash } from 'lodash';

const uf = new uFuzzy({
  intraMode: 1,
  intraIns: 1,
  intraSub: 1,
  intraTrn: 1,
  intraDel: 1,
});

export function fuzzySearch(haystack: string[], query: string, dispatcher: (data: string[][]) => void) {
  const [idxs, info, order] = uf.search(haystack, query, false, 1e5);

  let haystackOrder: string[] = [];
  let matchesSet: Set<string> = new Set();
  if (idxs && order) {
    /**
     * get the fuzzy matches for hilighting
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

    dispatcher([haystackOrder, [...matchesSet]]);
  } else if (!query) {
    dispatcher([[], []]);
  }
}

export const debouncedFuzzySearch = debounceLodash(fuzzySearch, 300);
