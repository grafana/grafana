import { useSyncExternalStore } from 'react';

import { Text } from '@grafana/ui';
import { STPodHealthPoller } from 'app/core/navigation/STPodHealthPoller';
import { getStPodReadyPromise, getStPodStatus, StPodStatus } from 'app/core/navigation/stPodReadiness';

// The ready promise resolves on both Ready and Timeout, the only transitions that hide the ellipsis.
const subscribeToStPodStatus = (onChange: () => void) => {
  let subscribed = true;
  getStPodReadyPromise().then(() => {
    if (subscribed) {
      onChange();
    }
  });
  return () => {
    subscribed = false;
  };
};

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
