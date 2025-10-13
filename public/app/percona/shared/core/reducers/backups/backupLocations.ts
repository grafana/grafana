import { createAsyncThunk } from '@reduxjs/toolkit';

import { createAsyncSlice } from 'app/features/alerting/unified/utils/redux';
import { StorageLocationsService } from 'app/percona/backup/components/StorageLocations/StorageLocations.service';
import { formatLocationList } from 'app/percona/backup/components/StorageLocations/StorageLocations.utils';

export const fetchStorageLocations = createAsyncThunk('percona/fetchBackupLocations', async () => {
  const rawData = await StorageLocationsService.list();
  return formatLocationList(rawData);
});

const perconaBackupLocationsSlice = createAsyncSlice('backupLocations', fetchStorageLocations, []).reducer;

export default perconaBackupLocationsSlice;
