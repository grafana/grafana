import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
 * current `solutions`: a recreated array of the same solutions keeps its cards, a solution
 * recreated under the same id (new inputs) reloads in place, and solutions no longer in the set
 * are simply never read.
 */
export function useOverviewPlacement(solutions: Solution[]): OverviewPlacement {
  // Keyed by id, not identity: a solution recreated for new inputs (the Kubernetes filter) reloads
  // in its own slot instead of rejoining the pending skeletons.
  const [placed, setPlaced] = useState(() => new Map<SolutionId, OverviewCard | null>());
  // Newest placement per solution: an older one that settles later must not overwrite it.
  const latest = useRef(new Map<SolutionId, Promise<OverviewCard | null>>());

  const place = useCallback((solution: Solution) => {
    // A recreated live solution holds its slot as a skeleton while its fresh facts settle; the same
    // object placed again (a recreated solutions array) keeps its card.
    setPlaced((prev) => {
      const card = prev.get(solution.id);
      return card?.kind === 'live' && card.solution !== solution
        ? new Map(prev).set(solution.id, { ...card, refreshing: true })
        : prev;
    });
    // resolveOverviewCard never rejects.
    const placement = resolveOverviewCard(solution);
    latest.current.set(solution.id, placement);
    placement.then((card) => {
      if (latest.current.get(solution.id) === placement) {
        setPlaced((prev) => new Map(prev).set(solution.id, card));
      }
    });
  }, []);

  useEffect(() => {
    for (const solution of solutions) {
      place(solution);
    }
  }, [solutions, place]);

  return useMemo(() => {
    const cards: OverviewCard[] = [];
    let pendingCount = 0;
    for (const solution of solutions) {
      const card = placed.get(solution.id);
      if (card) {
        cards.push(card);
      } else if (!placed.has(solution.id)) {
        pendingCount++;
      }
    }
    return { cards, pendingCount };
  }, [solutions, placed]);
}
