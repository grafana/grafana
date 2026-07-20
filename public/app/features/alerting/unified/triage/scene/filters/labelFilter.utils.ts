import uFuzzy from '@leeoniya/ufuzzy';

import { type LabelStats } from '../useLabelsBreakdown';

const uf = new uFuzzy({ intraMode: 1, intraIns: 1, intraSub: 1, intraTrn: 1, intraDel: 1 });

export interface LabelFilterResult {
  filteredLabels: LabelStats[];
  /** Keys matched only via a value — should be auto-expanded */
  valueMatchKeys: Set<string>;
  /** Per-key set of value indices that matched — used to filter shown values */
  valueHitMap: Map<string, Set<number>>;
}

export function filterLabels(allLabels: LabelStats[], labelFilter: string): LabelFilterResult {
  const term = labelFilter.trim();

  if (term === '') {
    return {
      filteredLabels: allLabels,
      valueMatchKeys: new Set(),
      valueHitMap: new Map(),
    };
  }

  const valueMatchKeys = new Set<string>();
  const valueHitMap = new Map<string, Set<number>>();
  const filteredLabels: LabelStats[] = [];

  const keyHaystack = allLabels.map((l) => l.key);
  const keyHitIdxs = new Set(uf.filter(keyHaystack, term) ?? []);

  for (let i = 0; i < allLabels.length; i++) {
    const label = allLabels[i];
    if (keyHitIdxs.has(i)) {
      // Key matched — include the label as-is, all values shown.
      filteredLabels.push(label);
    } else {
      // Key didn't match — check values.
      const valueHaystack = label.values.map((v) => v.value);
      const valueIdxs = uf.filter(valueHaystack, term);
      if (valueIdxs && valueIdxs.length > 0) {
        filteredLabels.push(label);
        valueMatchKeys.add(label.key);
        valueHitMap.set(label.key, new Set(valueIdxs));
      }
    }
  }

  return { filteredLabels, valueMatchKeys, valueHitMap };
}
