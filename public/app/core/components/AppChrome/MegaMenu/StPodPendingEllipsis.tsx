import { useSyncExternalStore } from 'react';

import { Text } from '@grafana/ui';
import { STPodHealthPoller } from 'app/core/navigation/STPodHealthPoller';
import { useIsUrlAllowed } from 'app/core/navigation/mtFallback';
import { getStPodStatus, StPodStatus, subscribeToStPodStatus } from 'app/core/navigation/stPodReadiness';

export const StPodPendingEllipsis = ({ url }: { url: string }) => {
  const isUrlAllowed = useIsUrlAllowed({ pathname: url.split(/[?#]/)[0] });
  const status = useSyncExternalStore(subscribeToStPodStatus, getStPodStatus);

  if (isUrlAllowed || status === StPodStatus.Ready || status === StPodStatus.Timeout) {
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
