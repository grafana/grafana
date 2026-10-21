import { useSyncExternalStore } from 'react';

import { Text } from '@grafana/ui';
import { STPodHealthPoller } from 'app/core/navigation/STPodHealthPoller';
import { getStPodStatus, StPodStatus, subscribeToStPodStatus } from 'app/core/navigation/stPodReadiness';

export const StPodPendingEllipsis = () => {
  const status = useSyncExternalStore(subscribeToStPodStatus, getStPodStatus);

  if (status === StPodStatus.Ready || status === StPodStatus.Timeout) {
    return null;
  }

  // GrafanaRoute only polls when the current route is not allowlisted, so on an allowlisted page
  // nothing else would ever mark the pod ready.
  return (
    <>
      <STPodHealthPoller skip={false} />
      <Text color="secondary" aria-hidden>
        ...
      </Text>
    </>
  );
};
