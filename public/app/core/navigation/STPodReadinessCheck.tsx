import { use } from 'react';

import { createStPodTimeoutError, getStPodReadyPromise, getStPodStatus, StPodStatus } from './stPodReadiness';

export const STPodReadinessCheck = ({ skip }: { skip: boolean }) => {
  if (skip) {
    return null;
  }

  const status = getStPodStatus();

  if (status === StPodStatus.Timeout) {
    throw createStPodTimeoutError();
  }

  if (status !== StPodStatus.Ready) {
    use(getStPodReadyPromise());
  }

  return null;
};
