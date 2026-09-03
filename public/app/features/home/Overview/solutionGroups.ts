import { type Solution, type SolutionOffer } from '../solutions/types';

export type OverviewCard =
  | { solution: Solution; kind: 'live'; needsAttention: boolean }
  | { solution: Solution; kind: 'offer'; offer: SolutionOffer };

export interface OverviewSolutionGroups {
  attention: OverviewCard[];
  enabled: OverviewCard[];
  available: OverviewCard[];
}

/**
 * Resolves every grouping fact before the grid renders. Attention failures read as false, and a
 * failed fact is isolated to its solution instead of rejecting the whole Overview.
 */
export async function resolveOverviewCards(solutions: Solution[]): Promise<OverviewCard[]> {
  const cards = await Promise.all(
    solutions.map(async (solution) => {
      const [datasource, needsAttention, offer] = await Promise.all([
        solution.datasource().catch(() => null),
        solution.needsAttention().catch(() => false),
        solution.offer().catch(() => null),
      ]);
      if (datasource) {
        return { solution, kind: 'live', needsAttention };
      }
      return offer ? { solution, kind: 'offer', offer } : null;
    })
  );
  return cards.filter((card): card is OverviewCard => card !== null);
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
