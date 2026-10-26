import { useSyncExternalStore } from 'react';

import { getStPodStatus, StPodStatus, subscribeToStPodStatus } from './stPodReadiness';

export const useIsStPodLoading = (enabled: boolean): boolean => {
  const status = useSyncExternalStore(subscribeToStPodStatus, getStPodStatus);
  return enabled && (status === StPodStatus.Unknown || status === StPodStatus.Waiting);
};
