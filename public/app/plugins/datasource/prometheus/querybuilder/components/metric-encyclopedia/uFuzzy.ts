import uFuzzy from '@leeoniya/ufuzzy';
import { debounce as debounceLodash } from 'lodash';

import { Action } from './state/types';
import { UFuzzyInfo } from './types';

const uf = new uFuzzy({
  intraMode: 1,
  intraIns: 1,
  intraSub: 1,
  intraTrn: 1,
  intraDel: 1,
});

export function fuzzySearch(
  haystack: string[],
  query: string,
  type: 'setMetaHaystackOrder' | 'setNameHaystackOrder',
  dispatcher: React.Dispatch<Action>
) {
  let idxs = uf.filter(haystack, query);
  idxs = idxs ?? [];
  // let idxs = u.filter(haystack, needle);
  let info: UFuzzyInfo = uf.info(idxs, haystack, query);
  let order = uf.sort(info, haystack, query);

  let haystackOrder: string[] = [];
  for (let i = 0; i < order.length; i++) {
    let infoIdx = order[i];

    haystackOrder.push(haystack[info.idx[infoIdx]]);
  }

  const action = {
    type: type,
    payload: haystackOrder,
  };

  idxs && dispatcher(action);
}

export const debouncedFuzzySearch = debounceLodash(fuzzySearch, 300);
