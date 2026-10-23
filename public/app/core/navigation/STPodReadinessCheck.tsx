import { use } from 'react';

import { useGrafana } from '../context/GrafanaContext';
import { StPodStatus } from '../services/StPodReadinessService';

export const STPodReadinessCheck = ({ skip }: { skip: boolean }) => {
  const { stPodReadiness } = useGrafana();
  const status = stPodReadiness.useStatus();

  if (skip || status === StPodStatus.Ready) {
    return null;
  }

  use(stPodReadiness.getReadyPromise());

  return null;
};
