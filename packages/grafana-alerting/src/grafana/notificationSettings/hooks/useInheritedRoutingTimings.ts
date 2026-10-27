import { useResolvedRoutingTree } from '../../notificationPolicies/hooks/useResolvedRoutingTree';
import { type RoutingTimings, TIMING_DEFAULTS } from '../constants';

/** What unset timings fall back to for a simplified-routing rule: the default policy's, or Alertmanager's built-in
 * defaults. The built-in defaults also show while the default policy loads or fails to load. */
export function useInheritedRoutingTimings(): Required<RoutingTimings> {
  const { tree } = useResolvedRoutingTree();

  return {
    groupWait: tree?.defaults.groupWait ?? TIMING_DEFAULTS.groupWait,
    groupInterval: tree?.defaults.groupInterval ?? TIMING_DEFAULTS.groupInterval,
    repeatInterval: tree?.defaults.repeatInterval ?? TIMING_DEFAULTS.repeatInterval,
  };
}
