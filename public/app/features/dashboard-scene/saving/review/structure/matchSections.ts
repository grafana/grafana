import { type PathKey } from '../types';

import { placedElements, type WalkedContainer, type WalkedLayout, type WalkedSection } from './walkLayout';

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

  const pair = (b: WalkedSection, p: WalkedSection) => {
    matching.baselineToPayload.set(b.path, p.path);
    matching.payloadToBaseline.set(p.path, b.path);
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
        pair(bs, ps);
        pairs.push([bs, ps]);
      }
    }

    const remainingB = b.sections.filter((s) => !isMatchedB(s));
    const remainingP = p.sections.filter((s) => !isMatchedP(s));
    remainingP.forEach((ps, rank) => {
      const candidates = [remainingB.find((s) => s.index === ps.index), remainingB[rank]];
      const bs = candidates.find((s) => s && !isMatchedB(s) && mostlySamePanels(s, ps));
      if (bs) {
        pair(bs, ps);
        pairs.push([bs, ps]);
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
        pair(bs, ps);
        pairs.push([bs, ps]);
      }
    }
    for (const ps of unmatchedP) {
      if (isMatchedP(ps)) {
        continue;
      }
      const bs = deeperB.find((s) => !isMatchedB(s) && s.title && s.title === ps.title && s.kind === ps.kind);
      if (bs) {
        pair(bs, ps);
        pairs.push([bs, ps]);
      }
    }
  };

  matchChildren(baseline.root, payload.root);
  return matching;
}

/** More than half of the larger side's panels are on both sides; two empty sections count as the same. */
export function mostlySamePanels(a: WalkedSection, b: WalkedSection): boolean {
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
