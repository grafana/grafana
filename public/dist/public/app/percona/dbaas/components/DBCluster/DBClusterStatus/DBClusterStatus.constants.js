import { DBClusterStatus } from '../DBCluster.types';
export const STATUS_DATA_QA = {
    [DBClusterStatus.changing]: 'pending',
    [DBClusterStatus.deleting]: 'deleting',
    [DBClusterStatus.failed]: 'failed',
    [DBClusterStatus.invalid]: 'invalid',
    [DBClusterStatus.ready]: 'active',
    [DBClusterStatus.suspended]: 'suspended',
    [DBClusterStatus.upgrading]: 'updating',
    [DBClusterStatus.unknown]: 'unknown',
};
export const COMPLETE_PROGRESS_DELAY = 4000;
//# sourceMappingURL=DBClusterStatus.constants.js.map