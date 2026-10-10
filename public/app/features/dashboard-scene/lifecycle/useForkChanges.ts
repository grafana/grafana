import { useEffect, useState } from 'react';

import { getDashboardResource, getDashboardSpecAtGeneration, type OriginalDashboard } from './lifecycleApi';
import { diffDashboardSpecs, type SpecChange } from './specDiff';

export interface ForkChanges {
  /** Changes in the fork relative to the original as it was when forked (or the latest original). */
  changes?: SpecChange[];
  forkSpec?: unknown;
  baseSpec?: unknown;
  latestSpec?: unknown;
}

/** Loads the saved fork and the original it was forked from, and diffs them. */
export function useForkChanges(
  uid: string,
  originalUid: string,
  forkBase: number | undefined,
  original: OriginalDashboard | null | undefined
): ForkChanges {
  const [state, setState] = useState<ForkChanges>({});
  const latestSpec = original?.spec;
  const latestGeneration = original?.generation;

  useEffect(() => {
    if (latestSpec === undefined) {
      return;
    }
    let cancelled = false;
    (async () => {
      const fork = await getDashboardResource(uid);
      const baseSpec =
        forkBase !== undefined && forkBase !== latestGeneration
          ? ((await getDashboardSpecAtGeneration(originalUid, forkBase).catch(() => undefined)) ?? latestSpec)
          : latestSpec;
      if (!cancelled) {
        setState({ changes: diffDashboardSpecs(baseSpec, fork.spec), forkSpec: fork.spec, baseSpec, latestSpec });
      }
    })().catch(() => !cancelled && setState({}));
    return () => {
      cancelled = true;
    };
  }, [uid, originalUid, forkBase, latestSpec, latestGeneration]);

  return state;
}
