import { useRef } from 'react';

// Long enough to cover a request racing right after the delete call, before a "not deleting"
// read has caught up with reality; short enough not to noticeably delay a legitimately fast
// finish (e.g. an already-empty folder).
const GRACE_PERIOD_MS = 4000;

/**
 * Whether a "not deleting anymore" signal (a 404, or a response with no deletionTimestamp) can be
 * trusted yet. The very first poll right after a delete call can still see a stale, pre-delete
 * read -- the backend hasn't necessarily finished writing (or this read hasn't caught up with)
 * the deletionTimestamp yet -- which looks exactly like "nothing is happening here." Trusting
 * that instantly can settle/redirect before the cascade has actually even started.
 *
 * Once this folder has genuinely been observed mid-cascade, any subsequent "done" signal is
 * unambiguous and trusted immediately. Until then, a short grace period is given for reads to
 * catch up, which also covers the case where a folder finishes so fast (e.g. it was already
 * empty) that "mid-cascade" is never actually observed at all.
 */
export function useTrustCascadeDoneSignal(isStillDeleting: boolean): boolean {
  const mountedAtRef = useRef<number | undefined>(undefined);
  if (mountedAtRef.current === undefined) {
    mountedAtRef.current = Date.now();
  }

  const hasConfirmedDeletingRef = useRef(false);
  if (isStillDeleting) {
    hasConfirmedDeletingRef.current = true;
  }

  return hasConfirmedDeletingRef.current || Date.now() - mountedAtRef.current > GRACE_PERIOD_MS;
}
