import { useSyncExternalStore } from 'react';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Icon } from '@grafana/ui';
import { toComparablePath } from 'app/core/navigation/comparablePath';
import { useIsUrlAllowed } from 'app/core/navigation/mtFallback';
import { getStPodStatus, StPodStatus, subscribeToStPodStatus } from 'app/core/navigation/stPodReadiness';

export const StPodPendingEllipsis = ({ url, label }: { url: string; label?: string }) => {
  const isUrlAllowed = useIsUrlAllowed({ pathname: toComparablePath(url, config.appSubUrl) });
  const status = useSyncExternalStore(subscribeToStPodStatus, getStPodStatus);

  if (isUrlAllowed || status === StPodStatus.Ready || status === StPodStatus.Timeout) {
    return null;
  }

  const message = label
    ? t('navigation.st-pod-pending-ellipsis.preparing-named', 'Preparing {{label}}', { label })
    : t('navigation.st-pod-pending-ellipsis.preparing', 'Preparing page');

  return <Icon name="ellipsis-h" aria-label={message} />;
};
