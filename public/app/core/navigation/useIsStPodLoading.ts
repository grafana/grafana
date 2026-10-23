import { config } from '@grafana/runtime';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { StPodStatus } from 'app/core/services/StPodReadyService';

import { toComparablePath } from './comparablePath';
import { useIsMtFallbackConfigured, useIsUrlAllowed } from './mtFallback';

export const useIsStPodLoading = (url: string): boolean => {
  const { stPodReady } = useGrafana();
  const isMtFallbackConfigured = useIsMtFallbackConfigured();
  const isUrlAllowed = useIsUrlAllowed({ pathname: toComparablePath(url, config.appSubUrl) });
  const status = stPodReady.useStatus();

  return isMtFallbackConfigured && !isUrlAllowed && (status === StPodStatus.Unknown || status === StPodStatus.Waiting);
};
