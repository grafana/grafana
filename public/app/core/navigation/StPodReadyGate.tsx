import { use } from 'react';

import { useGrafana } from '../context/GrafanaContext';
import { StPodStatus } from '../services/StPodReadyService';

export const StPodReadyGate = ({ skip }: { skip: boolean }) => {
  const { stPodReady } = useGrafana();
  const status = stPodReady.useStatus();

  if (skip || status === StPodStatus.Ready || status === StPodStatus.Unknown) {
    return null;
  }

  use(stPodReady.getReadyPromise());

  return null;
};
