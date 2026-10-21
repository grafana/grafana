import { useSyncExternalStore } from 'react';

import { getStPodStatus, StPodStatus, subscribeToStPodStatus } from './stPodReadiness';

export const useIsStPodLoading = (enabled: boolean): boolean =>
  useSyncExternalStore(subscribeToStPodStatus, () => {
    const status = getStPodStatus();
    return enabled && (status === StPodStatus.Unknown || status === StPodStatus.Waiting);
  });
