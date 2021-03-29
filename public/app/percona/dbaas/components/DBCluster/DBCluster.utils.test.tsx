import { isClusterChanging, getClusterStatus, formatResources, isOptionEmpty } from './DBCluster.utils';
import { dbClustersStub } from './__mocks__/dbClustersStubs';
import { DBClusterStatus, ResourcesUnits } from './DBCluster.types';

const DBCLUSTER_STATUS_MAP = {
  [DBClusterStatus.invalid]: 'XTRA_DB_CLUSTER_STATE_INVALID',
  [DBClusterStatus.changing]: 'XTRA_DB_CLUSTER_STATE_CHANGING',
  [DBClusterStatus.ready]: 'XTRA_DB_CLUSTER_STATE_READY',
  [DBClusterStatus.failed]: 'XTRA_DB_CLUSTER_STATE_FAILED',
  [DBClusterStatus.deleting]: 'XTRA_DB_CLUSTER_STATE_DELETING',
  [DBClusterStatus.suspended]: 'XTRA_DB_CLUSTER_STATE_PAUSED',
  [DBClusterStatus.unknown]: 'XTRA_DB_CLUSTER_STATE_UNKNOWN',
};

describe('DBCluster.utils::', () => {
  it('returns true if cluster is changing', () => {
    const result = isClusterChanging({
      ...dbClustersStub[0],
      status: DBClusterStatus.changing,
    });

    expect(result).toBeTruthy();
  });
  it('returns true if cluster is deleting', () => {
    const result = isClusterChanging({
      ...dbClustersStub[0],
      status: DBClusterStatus.deleting,
    });

    expect(result).toBeTruthy();
  });
  it('returns false if cluster is ready', () => {
    const result = isClusterChanging({
      ...dbClustersStub[0],
      status: DBClusterStatus.ready,
    });

    expect(result).toBeFalsy();
  });
  it('returns false if cluster is invalid', () => {
    const result = isClusterChanging({
      ...dbClustersStub[0],
      status: DBClusterStatus.invalid,
    });

    expect(result).toBeFalsy();
  });
  it('returns false if cluster has no status', () => {
    const result = isClusterChanging({
      ...dbClustersStub[0],
    });

    expect(result).toBeFalsy();
  });
  it('returns invalid status when receives XTRA_DB_CLUSTER_STATE_INVALID', () => {
    const result = getClusterStatus('XTRA_DB_CLUSTER_STATE_INVALID', DBCLUSTER_STATUS_MAP);

    expect(result).toBe(DBClusterStatus.invalid);
  });
  it('returns ready status when receives XTRA_DB_CLUSTER_STATE_READY', () => {
    const result = getClusterStatus('XTRA_DB_CLUSTER_STATE_READY', DBCLUSTER_STATUS_MAP);

    expect(result).toBe(DBClusterStatus.ready);
  });
  it('returns changing status when receives undefined', () => {
    const result = getClusterStatus(undefined, DBCLUSTER_STATUS_MAP);

    expect(result).toBe(DBClusterStatus.changing);
  });
  it('returns failed status when status doesnt exist', () => {
    const result = getClusterStatus('XTRA_DB_CLUSTER_STATE_UNKNOWN', DBCLUSTER_STATUS_MAP);

    expect(result).toBe(DBClusterStatus.unknown);
  });
  it('formats resources correctly', () => {
    expect(formatResources(1000, 2)).toEqual({ value: 1, units: ResourcesUnits.KB, original: 1000 });
    expect(formatResources(1010, 2)).toEqual({ value: 1.01, units: ResourcesUnits.KB, original: 1010 });
    expect(formatResources(1010, 1)).toEqual({ value: 1, units: ResourcesUnits.KB, original: 1010 });
    expect(formatResources(1010, 1)).toEqual({ value: 1, units: ResourcesUnits.KB, original: 1010 });
    expect(formatResources(1015, 3)).toEqual({ value: 1.015, units: ResourcesUnits.KB, original: 1015 });
    expect(formatResources(2597, 3)).toEqual({ value: 2.597, units: ResourcesUnits.KB, original: 2597 });
    expect(formatResources(1500000000, 2)).toEqual({ value: 1.5, units: ResourcesUnits.GB, original: 1500000000 });
    expect(formatResources(1570000000, 3)).toEqual({ value: 1.57, units: ResourcesUnits.GB, original: 1570000000 });
    expect(formatResources(6200000000000, 2)).toEqual({
      value: 6.2,
      units: ResourcesUnits.TB,
      original: 6200000000000,
    });
    expect(formatResources(6244440000000, 5)).toEqual({
      value: 6.24444,
      units: ResourcesUnits.TB,
      original: 6244440000000,
    });
  });
  it('indentifies empty option correctly', () => {
    expect(isOptionEmpty(undefined)).toBeTruthy();
    expect(isOptionEmpty({})).toBeTruthy();
    expect(isOptionEmpty({ label: 'test label' })).toBeTruthy();
    expect(isOptionEmpty({ value: 'test value' })).toBeFalsy();
  });
});
