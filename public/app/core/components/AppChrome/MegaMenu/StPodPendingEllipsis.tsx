import { config } from '@grafana/runtime';
import { toComparablePath } from 'app/core/navigation/comparablePath';
import { useIsMtFallbackConfigured, useIsUrlAllowed } from 'app/core/navigation/mtFallback';
import { useIsStPodLoading } from 'app/core/navigation/useIsStPodLoading';

import { StPodPendingDots } from './StPodPendingDots';

export const StPodPendingEllipsis = ({ url, itemName }: { url: string; itemName?: string }) => {
  const isMtFallbackConfigured = useIsMtFallbackConfigured();
  const isUrlAllowed = useIsUrlAllowed({ pathname: toComparablePath(url, config.appSubUrl) });
  const isStPodLoading = useIsStPodLoading(isMtFallbackConfigured && !isUrlAllowed);

  if (!isStPodLoading) {
    return null;
  }

  return <StPodPendingDots itemName={itemName} />;
};
