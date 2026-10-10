import { use } from 'react';

import { createStPodTimeoutError, getStPodReadyPromise, getStPodStatus } from './stPodReadiness';

export const STPodReadinessCheck = ({ isUrlAllowed }: { isUrlAllowed: boolean }) => {
  if (isUrlAllowed) {
    return null;
  }

  const status = getStPodStatus();

  if (status === 'gaveUp') {
    throw createStPodTimeoutError();
  }

  if (status !== 'ready') {
    use(getStPodReadyPromise());
  }

  return null;
};
