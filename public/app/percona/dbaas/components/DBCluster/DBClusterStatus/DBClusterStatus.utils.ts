import { Messages } from 'app/percona/dbaas/DBaaS.messages';

import { DBClusterStatus } from '../DBCluster.types';

const { progressError, processing, complete } = Messages.dbcluster.table.status;

export const getShowProgressBarValue = (status: DBClusterStatus, previousStatus: DBClusterStatus | undefined) => {
  // if the cluster just changed to ready we want to still show the progress bar
  if (previousStatus === DBClusterStatus.changing && status === DBClusterStatus.ready) {
    return true;
  }

  // if the cluster is in any of this status show the progress bar
  if (status === DBClusterStatus.changing || status === DBClusterStatus.invalid || status === DBClusterStatus.failed) {
    return true;
  }

  // if in any of other status (e.g. deleting, suspended, ...) no need to show the progress bar
  return false;
};

export const getProgressMessage = (status: DBClusterStatus, previousStatus: DBClusterStatus | undefined) => {
  if (status === DBClusterStatus.invalid || status === DBClusterStatus.failed) {
    return progressError;
  }

  if (previousStatus === DBClusterStatus.changing && status === DBClusterStatus.ready) {
    return complete;
  }

  return processing;
};
