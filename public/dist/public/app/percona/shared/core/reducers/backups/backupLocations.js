import { __awaiter } from "tslib";
import { createAsyncThunk } from '@reduxjs/toolkit';
import { createAsyncSlice } from 'app/features/alerting/unified/utils/redux';
import { StorageLocationsService } from 'app/percona/backup/components/StorageLocations/StorageLocations.service';
import { formatLocationList } from 'app/percona/backup/components/StorageLocations/StorageLocations.utils';
export const fetchStorageLocations = createAsyncThunk('percona/fetchBackupLocations', () => __awaiter(void 0, void 0, void 0, function* () {
    const rawData = yield StorageLocationsService.list();
    return formatLocationList(rawData);
}));
const perconaBackupLocationsSlice = createAsyncSlice('backupLocations', fetchStorageLocations, []).reducer;
export default perconaBackupLocationsSlice;
//# sourceMappingURL=backupLocations.js.map