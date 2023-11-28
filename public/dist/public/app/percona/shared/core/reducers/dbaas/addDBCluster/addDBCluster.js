import { __awaiter } from "tslib";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { withAppEvents } from 'app/features/alerting/unified/utils/redux';
import { newDBClusterService } from 'app/percona/dbaas/components/DBCluster/DBCluster.utils';
import { SETTINGS_TIMEOUT } from 'app/percona/shared/core/constants';
import { prepareSourceRanges } from 'app/percona/shared/core/reducers/dbaas/dbaas.utils';
import { updateSettingsAction } from 'app/percona/shared/core/reducers/index';
import { getCronStringFromValues } from 'app/percona/shared/helpers/cron/cron';
export const initialAddDBClusterState = {
    result: undefined,
    loading: undefined,
};
const perconaAddDBClusterSlice = createSlice({
    name: 'perconaAddDBCluster',
    initialState: initialAddDBClusterState,
    reducers: {
        resetAddDBClusterState: (state) => {
            return Object.assign(Object.assign({}, state), { result: undefined, loading: undefined });
        },
        setAddDBClusterLoading: (state) => {
            return Object.assign(Object.assign({}, state), { loading: true });
        },
        setAddDBClusterResult: (state, action) => {
            return Object.assign(Object.assign({}, state), { result: action.payload, loading: false });
        },
    },
});
export const addDbClusterAction = createAsyncThunk('percona/addDBCluster', (args, thunkAPI) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { name, kubernetesCluster, databaseType, databaseVersion, nodes, memory, cpu, disk, expose, internetFacing, sourceRanges, configuration, storageClass, restoreFrom, backupArtifact, backupLocation, retention, period, month, day, weekDay, startHour, startMinute, secretsName, enableRestore, enableBackups, template, } = args.values;
    const dbClusterService = newDBClusterService(databaseType.value);
    thunkAPI.dispatch(setAddDBClusterLoading());
    if (args.setPMMAddress) {
        yield thunkAPI.dispatch(updateSettingsAction({ body: { pmm_public_address: window.location.host } }));
        yield new Promise((resolve) => setTimeout(resolve, SETTINGS_TIMEOUT));
    }
    const cronExpression = getCronStringFromValues(period.value, month.map((m) => m.value), day.map((m) => m.value), weekDay.map((m) => m.value), startHour.map((m) => m.value), startMinute.map((m) => m.value));
    const preparedSourceRanges = prepareSourceRanges(sourceRanges);
    yield withAppEvents(dbClusterService.addDBCluster(Object.assign(Object.assign(Object.assign(Object.assign({ kubernetesClusterName: kubernetesCluster === null || kubernetesCluster === void 0 ? void 0 : kubernetesCluster.value, clusterName: name, databaseType: databaseType === null || databaseType === void 0 ? void 0 : databaseType.value, clusterSize: nodes, cpu,
        memory,
        disk, databaseImage: databaseVersion === null || databaseVersion === void 0 ? void 0 : databaseVersion.value, expose: !!expose, internetFacing: !!expose && !!internetFacing, sourceRanges: preparedSourceRanges, configuration }, ((storageClass === null || storageClass === void 0 ? void 0 : storageClass.value) && { storageClass: storageClass === null || storageClass === void 0 ? void 0 : storageClass.value })), (((_a = args.settings) === null || _a === void 0 ? void 0 : _a.backupEnabled) &&
        enableBackups && {
        backup: {
            cronExpression: cronExpression || '',
            locationId: (backupLocation === null || backupLocation === void 0 ? void 0 : backupLocation.value) || '',
            keepCopies: retention || '',
        },
    })), (((_b = args.settings) === null || _b === void 0 ? void 0 : _b.backupEnabled) &&
        enableRestore && {
        restore: {
            locationId: (restoreFrom === null || restoreFrom === void 0 ? void 0 : restoreFrom.value) || '',
            destination: (backupArtifact === null || backupArtifact === void 0 ? void 0 : backupArtifact.value) || '',
            secretsName: (secretsName === null || secretsName === void 0 ? void 0 : secretsName.value) || '',
        },
    })), (template && {
        template: {
            name: template.label,
            kind: template.value,
        },
    }))), {
        successMessage: 'Cluster was successfully added',
    })
        .then(() => {
        thunkAPI.dispatch(setAddDBClusterResult('ok'));
    })
        .catch(() => {
        thunkAPI.dispatch(setAddDBClusterResult('error'));
    });
}));
export const { setAddDBClusterResult, setAddDBClusterLoading, resetAddDBClusterState } = perconaAddDBClusterSlice.actions;
export default perconaAddDBClusterSlice.reducer;
//# sourceMappingURL=addDBCluster.js.map