import { combineReducers, createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CancelToken } from 'axios';
import { createAsyncSlice, withAppEvents, withSerializedError } from 'app/features/alerting/unified/utils/redux';
import { api, apiManagement } from 'app/percona/shared/helpers/api';
import { KubernetesService } from 'app/percona/dbaas/components/Kubernetes/Kubernetes.service';
import {
  CheckOperatorUpdateAPI,
  ComponentToUpdate,
  Kubernetes,
  KubernetesAPI,
  KubernetesListAPI,
  NewKubernetesCluster,
  Operator,
  OperatorsList,
} from 'app/percona/dbaas/components/Kubernetes/Kubernetes.types';
import {
  Settings,
  SettingsAPIChangePayload,
  SettingsAPIResponse,
  SettingsPayload,
} from 'app/percona/settings/Settings.types';
import { KubernetesClusterStatus } from 'app/percona/dbaas/components/Kubernetes/KubernetesClusterStatus/KubernetesClusterStatus.types';
import { OPERATOR_COMPONENT_TO_UPDATE_MAP } from 'app/percona/dbaas/components/Kubernetes/Kubernetes.constants';
import { formatDBClusters } from 'app/percona/dbaas/components/DBCluster/DBCluster.utils';
import { DBCluster } from 'app/percona/dbaas/components/DBCluster/DBCluster.types';
import { UserService } from '../services/user/User.service';
import { SettingsService } from 'app/percona/settings/Settings.service';
import { ServerInfo } from './types';

const toSettingsModel = (response: SettingsPayload): Settings => ({
  awsPartitions: response.aws_partitions,
  updatesDisabled: response.updates_disabled,
  telemetryEnabled: response.telemetry_enabled,
  metricsResolutions: response.metrics_resolutions,
  dataRetention: response.data_retention,
  sshKey: response.ssh_key,
  alertManagerUrl: response.alert_manager_url,
  alertManagerRules: response.alert_manager_rules,
  sttEnabled: response.stt_enabled,
  platformEmail: response.platform_email,
  azureDiscoverEnabled: response.azurediscover_enabled,
  dbaasEnabled: response.dbaas_enabled,
  alertingEnabled: response.alerting_enabled,
  alertingSettings: {
    email: response.email_alerting_settings || {},
    slack: response.slack_alerting_settings || {},
  },
  publicAddress: response.pmm_public_address,
  sttCheckIntervals: {
    rareInterval: response.stt_check_intervals.rare_interval,
    standardInterval: response.stt_check_intervals.standard_interval,
    frequentInterval: response.stt_check_intervals.frequent_interval,
  },
  backupEnabled: response.backup_management_enabled,
  isConnectedToPortal: response.connected_to_platform,
});

const initialSettingsState: Settings = {
  updatesDisabled: true,
  telemetryEnabled: false,
  backupEnabled: false,
  dbaasEnabled: false,
  metricsResolutions: {
    lr: '10s',
    hr: '15s',
    mr: '20s',
  },
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
};

export interface PerconaUserState {
  isAuthorized: boolean;
  isPlatformUser: boolean;
}

export const initialUserState: PerconaUserState = {
  isAuthorized: false,
  isPlatformUser: false,
};

const perconaUserSlice = createSlice({
  name: 'perconaUser',
  initialState: initialUserState,
  reducers: {
    setAuthorized: (state, action: PayloadAction<boolean>): PerconaUserState => ({
      ...state,
      isAuthorized: action.payload,
    }),
    setIsPlatformUser: (state, action: PayloadAction<boolean>): PerconaUserState => ({
      ...state,
      isPlatformUser: action.payload,
    }),
  },
});

export const { setAuthorized, setIsPlatformUser } = perconaUserSlice.actions;

export const fetchUserStatusAction = createAsyncThunk(
  'percona/fetchUserStatus',
  (_, thunkAPI): Promise<void> =>
    withSerializedError(
      (async () => {
        const isPlatformUser = await UserService.getUserStatus(undefined, true);
        thunkAPI.dispatch(setIsPlatformUser(isPlatformUser));
      })()
    )
);

export const fetchSettingsAction = createAsyncThunk(
  'percona/fetchSettings',
  (
    args: { usedPassword: string; testEmail: string } | undefined = { usedPassword: '', testEmail: '' }
  ): Promise<Settings> =>
    withSerializedError(
      (async () => {
        const settings = await SettingsService.getSettings(undefined, true);
        const modifiedSettings: Settings = {
          ...settings,
          alertingSettings: {
            ...settings.alertingSettings,
            email: {
              ...settings.alertingSettings.email,
              password: args.usedPassword,
              test_email: args.testEmail,
            },
          },
        };

        return modifiedSettings;
      })()
    )
);

export const updateSettingsAction = createAsyncThunk(
  'percona/updateSettings',
  (args: { body: Partial<SettingsAPIChangePayload>; token?: CancelToken }, thunkAPI): Promise<Settings> =>
    withAppEvents(
      withSerializedError(
        (async () => {
          let password = '';
          let testEmail = '';

          // we save the test email here so that we can sent it all the way down to the form again after re-render
          // the field is deleted from the payload so as not to be sent to the API
          if ('email_alerting_settings' in args.body) {
            password = args.body.email_alerting_settings!.password || '';
            testEmail = args.body.email_alerting_settings!.test_email || '';
            if (testEmail) {
              args.body.email_alerting_settings!.test_email = undefined;
            }
          }
          const { settings }: SettingsAPIResponse = await api.post<any, Partial<SettingsAPIChangePayload>>(
            '/v1/Settings/Change',
            args.body,
            false,
            args.token
          );
          await thunkAPI.dispatch(fetchSettingsAction({ usedPassword: password, testEmail }));
          return toSettingsModel(settings);
        })()
      ),
      {
        successMessage: 'Settings updated',
      }
    )
);

export const perconaUserReducers = perconaUserSlice.reducer;

const toKubernetesListModel = (
  response: KubernetesListAPI,
  checkUpdateResponse: CheckOperatorUpdateAPI
): Kubernetes[] => (response.kubernetes_clusters ?? []).map(toKubernetesModel(checkUpdateResponse));

const toKubernetesModel = (checkUpdateResponse: CheckOperatorUpdateAPI) => ({
  kubernetes_cluster_name: kubernetesClusterName,
  operators,
  status,
}: KubernetesAPI): Kubernetes => ({
  kubernetesClusterName,
  operators: toModelOperators(kubernetesClusterName, operators, checkUpdateResponse),
  status: status as KubernetesClusterStatus,
});

const toModelOperators = (
  kubernetesClusterName: string,
  operators: OperatorsList,
  { cluster_to_components }: CheckOperatorUpdateAPI
): OperatorsList => {
  const modelOperators = {} as OperatorsList;
  const componentToUpdate = cluster_to_components[kubernetesClusterName].component_to_update_information;

  Object.entries(operators).forEach(([operatorKey, operator]: [string, Operator]) => {
    const component = OPERATOR_COMPONENT_TO_UPDATE_MAP[operatorKey as keyof OperatorsList];

    modelOperators[operatorKey as keyof OperatorsList] = {
      availableVersion:
        componentToUpdate && componentToUpdate[component] ? componentToUpdate[component].available_version : undefined,
      ...operator,
    };
  });

  return modelOperators;
};

export const fetchKubernetesAction = createAsyncThunk(
  'percona/fetchKubernetes',
  async (tokens?: { kubernetes?: CancelToken; operator?: CancelToken }): Promise<Kubernetes[]> => {
    const [results, checkUpdateResults] = await Promise.all([
      KubernetesService.getKubernetes(tokens?.kubernetes),
      KubernetesService.checkForOperatorUpdate(tokens?.operator),
    ]);

    return toKubernetesListModel(results, checkUpdateResults);
  }
);

export const deleteKubernetesAction = createAsyncThunk(
  'percona/deleteKubernetes',
  async (args: { kubernetesToDelete: Kubernetes; force?: boolean }, thunkAPI): Promise<void> => {
    await withAppEvents(KubernetesService.deleteKubernetes(args.kubernetesToDelete, args.force), {
      successMessage: 'Cluster successfully unregistered',
    });
    await thunkAPI.dispatch(fetchKubernetesAction());
  }
);

export const addKubernetesAction = createAsyncThunk(
  'percona/addKubernetes',
  async (args: { kubernetesToAdd: NewKubernetesCluster; token?: CancelToken }, thunkAPI): Promise<void> => {
    await withAppEvents(KubernetesService.addKubernetes(args.kubernetesToAdd, args.token), {
      successMessage: 'Cluster was successfully registered',
    });
    await thunkAPI.dispatch(fetchKubernetesAction());
  }
);

export const instalKuberneteslOperatorAction = createAsyncThunk(
  'percona/instalKuberneteslOperator',
  async (
    args: { kubernetesClusterName: string; operatorType: ComponentToUpdate; availableVersion: string },
    thunkAPI
  ): Promise<void> => {
    await KubernetesService.installOperator(args.kubernetesClusterName, args.operatorType, args.availableVersion);
    await thunkAPI.dispatch(fetchKubernetesAction());
  }
);

export const fetchDBClustersAction = createAsyncThunk(
  'percona/fetchDBClusters',
  (args: { kubernetes: Kubernetes[]; tokens: CancelToken[] }): Promise<DBCluster[]> =>
    withSerializedError(
      (async () => {
        const requests = args.kubernetes.map((k, idx) =>
          apiManagement.post<any, Kubernetes>('/DBaaS/DBClusters/List', k, true, args.tokens[idx])
        );
        const promiseResults = await Promise.all(requests);
        return formatDBClusters(promiseResults, args.kubernetes);
      })()
    )
);
export interface PerconaServerState extends ServerInfo {
  saasHost: string;
}

export const initialServerState: PerconaServerState = {
  serverName: '',
  serverId: '',
  saasHost: 'https://portal.percona.com',
};

const perconaServerSlice = createSlice({
  name: 'perconaServer',
  initialState: initialServerState,
  reducers: {
    setServerInfo: (state, action: PayloadAction<ServerInfo>): PerconaServerState => ({
      ...state,
      serverName: action.payload.serverName,
      serverId: action.payload.serverId,
    }),
    setServerSaasHost: (state, action: PayloadAction<string>): PerconaServerState => ({
      ...state,
      saasHost: action.payload,
    }),
  },
});

const { setServerInfo, setServerSaasHost } = perconaServerSlice.actions;

export const perconaServerReducers = perconaServerSlice.reducer;

export const fetchServerInfoAction = createAsyncThunk(
  'percona/fetchServerInfo',
  (_, thunkAPI): Promise<void> =>
    withSerializedError(
      (async () => {
        const { pmm_server_id = '', pmm_server_name = '' } = await api.post<
          { pmm_server_id: string; pmm_server_name: string },
          Object
        >('/v1/Platform/ServerInfo', {}, true);

        thunkAPI.dispatch(
          setServerInfo({
            serverName: pmm_server_name,
            serverId: pmm_server_id,
          })
        );
      })()
    )
);

export const fetchServerSaasHostAction = createAsyncThunk(
  'percona/fetchServerSaasHost',
  (_, thunkAPI): Promise<void> =>
    withSerializedError(
      (async () => {
        let host = 'https://portal.percona.com';
        const { host: envHost = '' } = await api.get('/graph/percona-api/saas-host');

        if (envHost.includes('dev')) {
          host = 'https://platform-dev.percona.com';
        }
        thunkAPI.dispatch(setServerSaasHost(host));
      })()
    )
);

const kubernetesReducer = createAsyncSlice('kubernetes', fetchKubernetesAction).reducer;
const deleteKubernetesReducer = createAsyncSlice('deleteKubernetes', deleteKubernetesAction).reducer;
const addKubernetesReducer = createAsyncSlice('addKubernetes', addKubernetesAction).reducer;
const installKubernetesOperatorReducer = createAsyncSlice('instalKuberneteslOperator', instalKuberneteslOperatorAction)
  .reducer;
const DBClusterReducer = createAsyncSlice('DBCluster', fetchDBClustersAction).reducer;
const settingsReducer = createAsyncSlice('settings', fetchSettingsAction, initialSettingsState).reducer;
const updateSettingsReducer = createAsyncSlice('updateSettings', updateSettingsAction).reducer;

export default {
  percona: combineReducers({
    settings: settingsReducer,
    updateSettings: updateSettingsReducer,
    user: perconaUserReducers,
    kubernetes: kubernetesReducer,
    deleteKubernetes: deleteKubernetesReducer,
    addKubernetes: addKubernetesReducer,
    installKubernetesOperator: installKubernetesOperatorReducer,
    dbCluster: DBClusterReducer,
    server: perconaServerReducers,
  }),
};
