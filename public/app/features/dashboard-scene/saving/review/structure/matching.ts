import { type PathKey } from '../types';

import { placedElements, type WalkedContainer, type WalkedLayout, type WalkedSection } from './layout';

// --- Longest common subsequence ---

/**
 * One longest common subsequence of two lists of distinct ids: the items that kept their relative order.
 * Items outside it are the ones that moved. Among equally long subsequences it keeps the most items with
 * `stable(id)` true (e.g. grid coordinates unchanged), then the ones that come first in `a`, so the result
 * is deterministic.
 */
export function longestCommonSubsequence(
  a: string[],
  b: string[],
  stable: (id: string) => boolean = () => true
): string[] {
  // Score = length first, then the number of stable items.
  const unit = a.length + 1;
  const score: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      score[i][j] =
        a[i] === b[j]
          ? score[i + 1][j + 1] + unit + (stable(a[i]) ? 1 : 0)
          : Math.max(score[i + 1][j], score[i][j + 1]);
    }
  }
  const result: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      result.push(a[i]);
      i++;
      j++;
    } else if (score[i][j + 1] >= score[i + 1][j]) {
      // Skipping b's item keeps a[i] available, which favours the earlier baseline item on a tie.
      j++;
    } else {
      i++;
    }
  }
  return result;
}

// --- Section matching ---

export interface SectionMatching {
  baselineToPayload: Map<PathKey, PathKey>;
  payloadToBaseline: Map<PathKey, PathKey>;
}

/**
 * Matches rows and tabs across both layouts. Under each pair of matched parents (the root layouts are
 * always a pair), in this order:
 *  1. same title, the k-th occurrence of a title pairing with the k-th;
 *  2. same position (index in the parent, else rank among the still unmatched siblings) when most of
 *     their panels are the same, which makes it a title change;
 *  3. where the parent's layout kind changed (a restructure), same title and kind one level deeper or
 *     shallower, so wrapping rows into a new tab (or unwrapping them) keeps their identity.
 * Everything left over is a removal or an addition.
 */
export function matchSections(baseline: WalkedLayout, payload: WalkedLayout): SectionMatching {
  const matching: SectionMatching = { baselineToPayload: new Map(), payloadToBaseline: new Map() };

  const pair = (b: WalkedSection, p: WalkedSection, pairs: Array<[WalkedSection, WalkedSection]>) => {
    matching.baselineToPayload.set(b.path, p.path);
    matching.payloadToBaseline.set(p.path, b.path);
    pairs.push([b, p]);
  };
  const isMatchedB = (s: WalkedSection) => matching.baselineToPayload.has(s.path);
  const isMatchedP = (s: WalkedSection) => matching.payloadToBaseline.has(s.path);

  const matchChildren = (b: WalkedContainer, p: WalkedContainer) => {
    const pairs: Array<[WalkedSection, WalkedSection]> = [];

    for (const ps of p.sections) {
      if (!ps.title) {
        continue;
      }
      const bs = b.sections.find((s) => !isMatchedB(s) && s.title === ps.title);
      if (bs) {
        pair(bs, ps, pairs);
      }
    }

    const remainingB = b.sections.filter((s) => !isMatchedB(s));
    const remainingP = p.sections.filter((s) => !isMatchedP(s));
    remainingP.forEach((ps, rank) => {
      const candidates = [remainingB.find((s) => s.index === ps.index), remainingB[rank]];
      const bs = candidates.find((s) => s && !isMatchedB(s) && mostlySamePanels(s, ps));
      if (bs) {
        pair(bs, ps, pairs);
      }
    });

    if (b.kind !== p.kind) {
      matchAcrossOneLevel(b, p, pairs);
    }

    for (const [bs, ps] of pairs) {
      matchChildren(bs.container, ps.container);
    }
  };

  const matchAcrossOneLevel = (
    b: WalkedContainer,
    p: WalkedContainer,
    pairs: Array<[WalkedSection, WalkedSection]>
  ) => {
    const unmatchedB = b.sections.filter((s) => !isMatchedB(s));
    const unmatchedP = p.sections.filter((s) => !isMatchedP(s));
    const deeperP = unmatchedP.flatMap((s) => s.container.sections);
    const deeperB = unmatchedB.flatMap((s) => s.container.sections);

    for (const bs of unmatchedB) {
      const ps = deeperP.find((s) => !isMatchedP(s) && s.title && s.title === bs.title && s.kind === bs.kind);
      if (ps) {
        pair(bs, ps, pairs);
      }
    }
    for (const ps of unmatchedP) {
      if (isMatchedP(ps)) {
        continue;
      }
      const bs = deeperB.find((s) => !isMatchedB(s) && s.title && s.title === ps.title && s.kind === ps.kind);
      if (bs) {
        pair(bs, ps, pairs);
      }
    }
  };

  matchChildren(baseline.root, payload.root);
  return matching;
}

/** More than half of the larger side's panels are on both sides; two empty sections count as the same. */
function mostlySamePanels(a: WalkedSection, b: WalkedSection): boolean {
  const panelsA = new Set(placedElements(a.container));
  const panelsB = new Set(placedElements(b.container));
  if (!panelsA.size && !panelsB.size) {
    return true;
  }
  let common = 0;
  panelsA.forEach((name) => {
    if (panelsB.has(name)) {
      common++;
    }
  });
  return common * 2 > Math.max(panelsA.size, panelsB.size);
}
