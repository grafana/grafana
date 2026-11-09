import { useMemo } from 'react';

import { useResolvedRoutingTree } from '../../notificationPolicies/hooks/useResolvedRoutingTree';
import { type RoutingTimings, TIMING_DEFAULTS } from '../constants';

export interface InheritedRoutingTimings {
  /** Anything but `found` means the default policy couldn't be read, so `timings` are Alertmanager's built-in
   * defaults rather than what the policy sets. */
  status: 'resolving' | 'error' | 'found';
  /** What unset timings fall back to for a simplified-routing rule: the default policy's, or the built-in defaults. */
  timings: Required<RoutingTimings>;
}

export function useInheritedRoutingTimings(): InheritedRoutingTimings {
  const { tree, isResolving, isError } = useResolvedRoutingTree();

  const timings = useMemo(
    () => ({
      groupWait: tree?.defaults.groupWait ?? TIMING_DEFAULTS.groupWait,
      groupInterval: tree?.defaults.groupInterval ?? TIMING_DEFAULTS.groupInterval,
      repeatInterval: tree?.defaults.repeatInterval ?? TIMING_DEFAULTS.repeatInterval,
    }),
    [tree]
  );

  if (isError) {
    return { status: 'error', timings };
  }
  return { status: isResolving ? 'resolving' : 'found', timings };
}
