import { __awaiter } from "tslib";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { combineReducers, createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { createAsyncSlice, withAppEvents, withSerializedError } from 'app/features/alerting/unified/utils/redux';
import { KubernetesService } from 'app/percona/dbaas/components/Kubernetes/Kubernetes.service';
import { AlertRuleTemplateService } from 'app/percona/integrated-alerting/components/AlertRuleTemplate/AlertRuleTemplate.service';
import { SettingsService } from 'app/percona/settings/Settings.service';
import { PlatformService } from 'app/percona/settings/components/Platform/Platform.service';
import { api } from 'app/percona/shared/helpers/api';
import { uiEventsReducer } from 'app/percona/ui-events/reducer';
import advisorsReducers from './advisors/advisors';
import perconaBackupLocations from './backups/backupLocations';
import perconaAddDBCluster from './dbaas/addDBCluster/addDBCluster';
import perconaDBClustersReducer from './dbaas/dbClusters/dbClusters';
import perconaDBaaSReducer from './dbaas/dbaas';
import perconaK8SCluster from './dbaas/k8sCluster/k8sCluster';
import perconaK8SClusterListReducer, { fetchK8sListAction } from './dbaas/k8sClusterList/k8sClusterList';
import perconaUpdateDBCluster from './dbaas/updateDBCluster/updateDBCluster';
import nodesReducer from './nodes';
import rolesReducers from './roles/roles';
import servicesReducer from './services';
import tourReducer from './tour/tour';
import perconaUserReducers from './user/user';
import usersReducers from './users/users';
const initialSettingsState = {
    updatesDisabled: true,
    telemetryEnabled: false,
    backupEnabled: false,
    dbaasEnabled: false,
    metricsResolutions: {
        lr: '10s',
        hr: '15s',
        mr: '20s',
    },
    telemetrySummaries: [],
    dataRetention: '',
    sshKey: '',
    awsPartitions: [],
    alertManagerUrl: '',
    alertManagerRules: '',
    sttEnabled: false,
    alertingEnabled: false,
    alertingSettings: {
        email: {
            from: '',
            smarthost: '',
            hello: '',
            require_tls: false,
        },
        slack: {
            url: '',
        },
    },
    sttCheckIntervals: {
        rareInterval: '10s',
        standardInterval: '10s',
        frequentInterval: '10s',
    },
    isConnectedToPortal: false,
    defaultRoleId: 1,
    enableAccessControl: false,
};
export const fetchSettingsAction = createAsyncThunk('percona/fetchSettings', (args = { usedPassword: '', testEmail: '' }) => withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
    const settings = yield SettingsService.getSettings(undefined, true);
    const modifiedSettings = Object.assign(Object.assign({}, settings), { alertingSettings: Object.assign(Object.assign({}, settings.alertingSettings), { email: Object.assign(Object.assign({}, settings.alertingSettings.email), { password: args.usedPassword, test_email: args.testEmail }) }) });
    return modifiedSettings;
}))()));
export const updateSettingsAction = createAsyncThunk('percona/updateSettings', (args, thunkAPI) => withAppEvents(withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
    let password = '';
    let testEmail = '';
    // we save the test email here so that we can sent it all the way down to the form again after re-render
    // the field is deleted from the payload so as not to be sent to the API
    if ('email_alerting_settings' in args.body) {
        password = args.body.email_alerting_settings.password || '';
        testEmail = args.body.email_alerting_settings.test_email || '';
        if (testEmail) {
            args.body.email_alerting_settings.test_email = undefined;
        }
    }
    const settings = yield SettingsService.setSettings(args.body, args.token);
    yield thunkAPI.dispatch(fetchSettingsAction({ usedPassword: password, testEmail }));
    return settings;
}))()), {
    successMessage: 'Settings updated',
}));
export const deleteKubernetesAction = createAsyncThunk('percona/deleteKubernetes', (args, thunkAPI) => __awaiter(void 0, void 0, void 0, function* () {
    yield withAppEvents(KubernetesService.deleteKubernetes(args.kubernetesToDelete, args.force), {
        successMessage: 'Cluster successfully unregistered',
    });
    yield thunkAPI.dispatch(fetchK8sListAction({}));
}));
export const instalKuberneteslOperatorAction = createAsyncThunk('percona/instalKuberneteslOperator', (args, thunkAPI) => __awaiter(void 0, void 0, void 0, function* () {
    yield KubernetesService.installOperator(args.kubernetesClusterName, args.operatorType, args.availableVersion);
    yield thunkAPI.dispatch(fetchK8sListAction({}));
}));
export const initialServerState = {
    serverName: '',
    serverId: '',
    saasHost: 'https://portal.percona.com',
    serverTelemetryId: '',
};
const perconaServerSlice = createSlice({
    name: 'perconaServer',
    initialState: initialServerState,
    reducers: {
        setServerInfo: (state, action) => (Object.assign(Object.assign({}, state), { serverName: action.payload.serverName, serverId: action.payload.serverId, serverTelemetryId: action.payload.serverTelemetryId })),
        setServerSaasHost: (state, action) => (Object.assign(Object.assign({}, state), { saasHost: action.payload })),
    },
});
const { setServerInfo, setServerSaasHost } = perconaServerSlice.actions;
export const perconaServerReducers = perconaServerSlice.reducer;
export const fetchServerInfoAction = createAsyncThunk('percona/fetchServerInfo', (_, thunkAPI) => withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
    const { pmm_server_id = '', pmm_server_name = '', pmm_server_telemetry_id = '', } = yield PlatformService.getServerInfo();
    thunkAPI.dispatch(setServerInfo({
        serverName: pmm_server_name,
        serverId: pmm_server_id,
        serverTelemetryId: pmm_server_telemetry_id,
    }));
}))()));
export const fetchServerSaasHostAction = createAsyncThunk('percona/fetchServerSaasHost', (_, thunkAPI) => withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
    const { host } = (yield api.get('/graph/percona-api/saas-host', true));
    thunkAPI.dispatch(setServerSaasHost(host));
}))()));
export const fetchTemplatesAction = createAsyncThunk('percona/fetchTemplates', () => __awaiter(void 0, void 0, void 0, function* () {
    return withSerializedError(AlertRuleTemplateService.list({
        page_params: {
            index: 0,
            page_size: 100,
        },
    }));
}));
const deleteKubernetesReducer = createAsyncSlice('deleteKubernetes', deleteKubernetesAction).reducer;
const installKubernetesOperatorReducer = createAsyncSlice('instalKuberneteslOperator', instalKuberneteslOperatorAction).reducer;
const settingsReducer = createAsyncSlice('settings', fetchSettingsAction, initialSettingsState).reducer;
const updateSettingsReducer = createAsyncSlice('updateSettings', updateSettingsAction).reducer;
const templatesReducer = createAsyncSlice('templates', fetchTemplatesAction).reducer;
export default {
    percona: combineReducers({
        settings: settingsReducer,
        updateSettings: updateSettingsReducer,
        user: perconaUserReducers,
        dbaas: perconaDBaaSReducer,
        kubernetes: perconaK8SClusterListReducer,
        deleteKubernetes: deleteKubernetesReducer,
        addKubernetes: perconaK8SCluster,
        addDBCluster: perconaAddDBCluster,
        updateDBCluster: perconaUpdateDBCluster,
        installKubernetesOperator: installKubernetesOperatorReducer,
        dbClusters: perconaDBClustersReducer,
        server: perconaServerReducers,
        templates: templatesReducer,
        services: servicesReducer,
        nodes: nodesReducer,
        backupLocations: perconaBackupLocations,
        tour: tourReducer,
        telemetry: uiEventsReducer,
        roles: rolesReducers,
        users: usersReducers,
        advisors: advisorsReducers,
    }),
};
//# sourceMappingURL=index.js.map