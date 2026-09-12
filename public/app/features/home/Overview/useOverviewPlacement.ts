import { useEffect, useMemo, useState } from 'react';

import { type Solution } from '../solutions/types';

import { type OverviewCard, resolveOverviewCard } from './solutionGroups';

export interface OverviewPlacement {
  /** Placed cards in `solutions` order; solutions with neither datasource nor offer are omitted. */
  cards: OverviewCard[];
  /** Solutions whose placement is still resolving. */
  pendingCount: number;
}

/**
 * Places each solution independently so a card appears as soon as its own facts settle instead
 * of waiting for the slowest solution. Placement is keyed by solution identity and read through
 * the current `solutions`, so a recreated array of the same solutions keeps its cards and
 * solutions no longer in the set are simply never read.
 */
export function useOverviewPlacement(solutions: Solution[]): OverviewPlacement {
  const [placed, setPlaced] = useState(() => new Map<Solution, OverviewCard | null>());

  useEffect(() => {
    let cancelled = false;
    for (const solution of solutions) {
      // resolveOverviewCard never rejects.
      resolveOverviewCard(solution).then((card) => {
        if (!cancelled) {
          setPlaced((prev) => new Map(prev).set(solution, card));
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
      const card = placed.get(solution);
      if (card) {
        cards.push(card);
      } else if (!placed.has(solution)) {
        pendingCount++;
      }
    }
    return { cards, pendingCount };
  }, [solutions, placed]);
}
