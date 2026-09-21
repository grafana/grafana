import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { store } from '@grafana/data';

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
  // Newest placement per solution: an older one that settles later must not overwrite it.
  const latest = useRef(new Map<Solution, Promise<OverviewCard | null>>());

  // `refreshing` keeps an already-placed live card in its slot as a skeleton while facts reload; the
  // initial placement never marks it, so a recreated solutions array does not flash placed cards.
  const place = useCallback((solution: Solution, refreshing: boolean) => {
    if (refreshing) {
      setPlaced((prev) => {
        const card = prev.get(solution);
        return card?.kind === 'live' ? new Map(prev).set(solution, { ...card, refreshing: true }) : prev;
      });
    }
    // resolveOverviewCard never rejects.
    const placement = resolveOverviewCard(solution);
    latest.current.set(solution, placement);
    placement.then((card) => {
      if (latest.current.get(solution) === placement) {
        setPlaced((prev) => new Map(prev).set(solution, card));
      }
    });
  }, []);

  useEffect(() => {
    // Subscribe before placing so a scope change during the initial placement supersedes it. A saved
    // or cleared scope re-places its solution in place: the card holds its slot instead of rejoining
    // the pending skeletons, then re-enters whichever group its fresh facts decide.
    const unsubscribes = solutions.flatMap((solution) =>
      solution.scopeStorageKey ? [store.subscribe(solution.scopeStorageKey, () => place(solution, true))] : []
    );
    for (const solution of solutions) {
      place(solution, false);
    }
    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [solutions, place]);

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
