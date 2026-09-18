import { useEffect, useMemo, useState } from 'react';

import { type Solution, type SolutionId } from '../solutions/types';

import { type OverviewCard, resolveOverviewCard } from './solutionGroups';

export interface OverviewPlacement {
  /** Placed cards in `solutions` order; solutions with neither datasource nor offer are omitted. */
  cards: OverviewCard[];
  /** Solutions whose placement is still resolving. */
  pendingCount: number;
}

/**
 * Places each solution independently so a card appears as soon as its own facts settle instead
 * of waiting for the slowest solution. Placement is keyed by solution id and read through the
 * current `solutions`: a recreated array keeps its cards, solutions no longer in the set are never
 * read, and a rebuilt solution (same id, new instance — e.g. after a Kubernetes filter save) holds
 * its last section while its own placement re-resolves, rendering the new instance so its facts
 * refetch in place.
 */
export function useOverviewPlacement(solutions: Solution[]): OverviewPlacement {
  // Absent = still resolving; null = resolved to no card.
  const [placed, setPlaced] = useState<Partial<Record<SolutionId, OverviewCard | null>>>({});

  useEffect(() => {
    let cancelled = false;
    for (const solution of solutions) {
      // resolveOverviewCard never rejects.
      resolveOverviewCard(solution).then((card) => {
        if (!cancelled) {
          setPlaced((prev) => ({ ...prev, [solution.id]: card }));
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [solutions]);

  return useMemo(() => {
    const cards: OverviewCard[] = [];
    let pendingCount = 0;
    for (const solution of solutions) {
      const card = placed[solution.id];
      if (card) {
        cards.push(card.solution === solution ? card : { ...card, solution });
      } else if (!(solution.id in placed)) {
        pendingCount++;
      }
    }
    return { cards, pendingCount };
  }, [solutions, placed]);
}
