import { type Solution, type SolutionOffer } from '../solutions/types';

export type OverviewCard =
  | { solution: Solution; kind: 'live'; needsAttention: boolean }
  | { solution: Solution; kind: 'offer'; offer: SolutionOffer };

export interface OverviewSolutionGroups {
  attention: OverviewCard[];
  enabled: OverviewCard[];
  available: OverviewCard[];
}

const placements = new WeakMap<Solution, Promise<OverviewCard | null>>();

/**
 * Places one solution: live when a datasource proved data (its own attention fact decides the
 * group), otherwise an offer, otherwise hidden. Rejected facts degrade only this solution:
 * datasource and offer read as absent, attention as false. Never rejects. One placement per
 * solution object, so the page-mount warm-up and every Overview mount share it.
 */
export function resolveOverviewCard(solution: Solution): Promise<OverviewCard | null> {
  let placement = placements.get(solution);
  if (!placement) {
    placement = placeSolution(solution);
    placements.set(solution, placement);
  }
  return placement;
}

async function placeSolution(solution: Solution): Promise<OverviewCard | null> {
  const datasource = await solution.datasource().catch(() => null);
  if (datasource) {
    const needsAttention = await solution.needsAttention().catch(() => false);
    return { solution, kind: 'live', needsAttention };
  }
  const offer = await solution.offer().catch(() => null);
  return offer ? { solution, kind: 'offer', offer } : null;
}

export function groupOverviewCards(cards: OverviewCard[]): OverviewSolutionGroups {
  const groups: OverviewSolutionGroups = { attention: [], enabled: [], available: [] };
  for (const card of cards) {
    if (card.kind === 'offer') {
      groups.available.push(card);
    } else if (card.needsAttention) {
      groups.attention.push(card);
    } else {
      groups.enabled.push(card);
    }
  }
  return groups;
}
