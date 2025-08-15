// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/metrics-modal/uFuzzy.ts
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
  const [idxs, info, order] = uf.search(haystack, query, 0, 1e5);

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

function isDigit(character: string) {
  const charCode = character.charCodeAt(0);
  const CHAR_CODE_0 = '0'.charCodeAt(0);
  const CHAR_CODE_9 = '9'.charCodeAt(0);

  return charCode >= CHAR_CODE_0 && charCode <= CHAR_CODE_9;
}

function isLetter(character: string) {
  const charCode = character.charCodeAt(0);
  const CHAR_CODE_A = 'a'.charCodeAt(0);
  const CHAR_CODE_Z = 'z'.charCodeAt(0);
  const CHAR_CODE_A_UPPER = 'A'.charCodeAt(0);
  const CHAR_CODE_Z_UPPER = 'Z'.charCodeAt(0);

  return (charCode >= CHAR_CODE_A && charCode <= CHAR_CODE_Z) || 
    (charCode >= CHAR_CODE_A_UPPER && charCode <= CHAR_CODE_Z_UPPER);
}

export function convertToPromqlCompliantString(query: string) {
  return query
  .split('')
  .map((c) => {
    if(isDigit(c) || isLetter(c) || c === '_' || c === ':') {
      return c;
    }

    return '_';
  }).join('');
}

// TODO: replace with fuzzySearch when we have bandwidth to implement performant fuzzy search
function promqlCompliantMatch(haystack: string[], query: string, dispatcher: (data: string[][]) => void) {
  if (!query) {
    dispatcher([[], []]);
  }

  dispatcher([
    haystack.filter((item) => item.includes(convertToPromqlCompliantString(query))),
    [],
  ]);
}

export const debouncedPromqlCompliantMatch = debounceLodash(promqlCompliantMatch, 300);
