import { createAsyncThunk } from '@reduxjs/toolkit';

import { SelectableValue } from '@grafana/data';
import { createAsyncSlice } from 'app/features/alerting/unified/utils/redux';
import { DBaaSBackupService } from 'app/percona/dbaas/components/DBCluster/EditDBClusterPage/DBaaSBackups/DBaaSBackups.service';
export const fetchBackupArtifacts = createAsyncThunk(
  'percona/fetchBackupArtifacts',
  async (args: { locationId: string }, thunkAPI): Promise<Array<SelectableValue<string>>> => {
    const backupArtifactsResponse = await DBaaSBackupService.list(args.locationId);

    return backupArtifactsResponse.map((backup) => ({
      label: backup.key,
      value: backup.key,
    }));
  }
);

const perconaBackupArtifactsSlice = createAsyncSlice('fetchBackupArtifacts', fetchBackupArtifacts, []).reducer;

export default perconaBackupArtifactsSlice;
