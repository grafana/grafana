import { useEffect, useState } from 'react';

import { getDashboardSpecAtGeneration, type SavedDashboard } from './lifecycleApi';
import { type DashboardPendingChanges } from './pendingChangePreview';
import { diffDashboardSpecs, type SpecChange } from './specDiff';

export interface PendingChangeDiff {
  /** The pending changes relative to the dashboard version they start from (or the latest). */
  changes?: SpecChange[];
  /** The dashboard as the changes started; the latest one when history no longer has it. */
  baseSpec?: unknown;
}

/** Diffs the pending changes against the dashboard version they start from. */
export function usePendingChangeDiff(
  uid: string,
  pending: Pick<DashboardPendingChanges, 'baseGeneration' | 'proposed'>,
  saved: SavedDashboard | null | undefined
): PendingChangeDiff {
  const [state, setState] = useState<PendingChangeDiff>({});
  const latestSpec = saved?.spec;
  const latestGeneration = saved?.generation;
  const { baseGeneration, proposed } = pending;

  useEffect(() => {
    if (latestSpec === undefined) {
      return;
    }
    let cancelled = false;
    (async () => {
      const baseSpec =
        baseGeneration !== latestGeneration
          ? ((await getDashboardSpecAtGeneration(uid, baseGeneration).catch(() => undefined)) ?? latestSpec)
          : latestSpec;
      if (!cancelled) {
        setState({ changes: diffDashboardSpecs(baseSpec, proposed), baseSpec });
      }
    })().catch(() => !cancelled && setState({}));
    return () => {
      cancelled = true;
    };
  }, [uid, baseGeneration, proposed, latestSpec, latestGeneration]);

  return state;
}
