import { config } from '@grafana/runtime';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { toComparablePath } from 'app/core/navigation/comparablePath';
import { useIsMtFallbackConfigured, useIsUrlAllowed } from 'app/core/navigation/mtFallback';
import { StPodStatus } from 'app/core/services/StPodReadinessService';

import { StPodPendingDots } from './StPodPendingDots';

const PENDING_STATUSES: ReadonlySet<StPodStatus> = new Set([StPodStatus.Unknown, StPodStatus.Waiting]);

export const StPodPendingEllipsis = ({ url, itemName }: { url: string; itemName?: string }) => {
  const { stPodReadiness } = useGrafana();
  const isMtFallbackConfigured = useIsMtFallbackConfigured();
  const isUrlAllowed = useIsUrlAllowed({ pathname: toComparablePath(url, config.appSubUrl) });
  const status = stPodReadiness.useStatus();

  const shouldShowDots = isMtFallbackConfigured && !isUrlAllowed && PENDING_STATUSES.has(status);

  if (!shouldShowDots) {
    return null;
  }

  return <StPodPendingDots itemName={itemName} />;
};
