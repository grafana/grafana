import { useSyncExternalStore } from 'react';

import { config } from '@grafana/runtime';
import { Icon } from '@grafana/ui';
import { toComparablePath } from 'app/core/navigation/comparablePath';
import { useIsUrlAllowed } from 'app/core/navigation/mtFallback';
import { getStPodStatus, StPodStatus, subscribeToStPodStatus } from 'app/core/navigation/stPodReadiness';

export const StPodPendingEllipsis = ({ url }: { url: string }) => {
  const isUrlAllowed = useIsUrlAllowed({ pathname: toComparablePath(url, config.appSubUrl) });
  const status = useSyncExternalStore(subscribeToStPodStatus, getStPodStatus);

  if (isUrlAllowed || status === StPodStatus.Ready || status === StPodStatus.Timeout) {
    return null;
  }

  return <Icon name="ellipsis-h" aria-hidden />;
};
