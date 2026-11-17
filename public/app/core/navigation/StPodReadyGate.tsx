import { use, useEffect } from 'react';

import { useGrafana } from '../context/GrafanaContext';
import { StPodStatus } from '../services/StPodReadyService';

export const StPodReadyGate = ({ skip }: { skip: boolean }) => {
  const { stPodReady } = useGrafana();
  const status = stPodReady.useStatus();

  useEffect(() => {
    if (!skip && status === StPodStatus.Captcha) {
      window.location.reload();
    }
  }, [skip, status]);

  if (skip || status === StPodStatus.Ready || status === StPodStatus.Unknown || status === StPodStatus.Captcha) {
    return null;
  }

  use(stPodReady.getReadyPromise());

  return null;
};
