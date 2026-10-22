import { config } from '@grafana/runtime';
import { toComparablePath } from 'app/core/navigation/comparablePath';
import { useIsUrlAllowed } from 'app/core/navigation/mtFallback';
import { useIsStPodLoading } from 'app/core/navigation/useIsStPodLoading';

import { StPodPendingDots } from './StPodPendingDots';

export const StPodPendingEllipsis = ({ url }: { url: string }) => {
  const isUrlAllowed = useIsUrlAllowed({ pathname: toComparablePath(url, config.appSubUrl) });
  const isStPodLoading = useIsStPodLoading(!isUrlAllowed);

  if (!isStPodLoading) {
    return null;
  }

  return <StPodPendingDots />;
};
