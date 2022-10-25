import { Messages } from 'app/percona/dbaas/DBaaS.messages';

import { DBClusterStatus } from '../DBCluster.types';

import { getProgressMessage, getShowProgressBarValue } from './DBClusterStatus.utils';

const { progressError, processing, complete } = Messages.dbcluster.table.status;

describe('DBClusterStatus.utils::', () => {
  it('shows progress bar when status is changing', () => {
    expect(getShowProgressBarValue(DBClusterStatus.changing, undefined)).toBeTruthy();
  });

  it('shows progress bar when status just changed to ready', () => {
    expect(getShowProgressBarValue(DBClusterStatus.ready, DBClusterStatus.changing)).toBeTruthy();
  });

  it("doesn't show progress bar when status is suspended", () => {
    expect(getShowProgressBarValue(DBClusterStatus.suspended, DBClusterStatus.changing)).toBeFalsy();
  });

  it("doesn't show progress bar when status is unknown", () => {
    expect(getShowProgressBarValue(DBClusterStatus.unknown, undefined)).toBeFalsy();
  });

  it('returns correct message when status is changing', () => {
    expect(getProgressMessage(DBClusterStatus.changing, undefined)).toEqual(processing);
  });

  it('returns correct message when status just changed to ready', () => {
    expect(getProgressMessage(DBClusterStatus.ready, DBClusterStatus.changing)).toEqual(complete);
  });

  it('returns correct message when status is failed', () => {
    expect(getProgressMessage(DBClusterStatus.failed, DBClusterStatus.ready)).toEqual(progressError);
  });
});
