/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { combineReducers, createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CancelToken } from 'axios';

import { createAsyncSlice, withAppEvents, withSerializedError } from 'app/features/alerting/unified/utils/redux';
import { OPERATOR_COMPONENT_TO_UPDATE_MAP } from 'app/percona/dbaas/components/Kubernetes/Kubernetes.constants';
import { KubernetesService } from 'app/percona/dbaas/components/Kubernetes/Kubernetes.service';
import {
  CheckOperatorUpdateAPI,
  ComponentToUpdate,
  Kubernetes,
  KubernetesAPI,
  KubernetesListAPI,
  Operator,
  OperatorsList,
} from 'app/percona/dbaas/components/Kubernetes/Kubernetes.types';
import { KubernetesClusterStatus } from 'app/percona/dbaas/components/Kubernetes/KubernetesClusterStatus/KubernetesClusterStatus.types';
import { AlertRuleTemplateService } from 'app/percona/integrated-alerting/components/AlertRuleTemplate/AlertRuleTemplate.service';
import { TemplatesList } from 'app/percona/integrated-alerting/components/AlertRuleTemplate/AlertRuleTemplate.types';
import { SettingsService } from 'app/percona/settings/Settings.service';
import { Settings, SettingsAPIChangePayload } from 'app/percona/settings/Settings.types';
import { PlatformService } from 'app/percona/settings/components/Platform/Platform.service';
import { api } from 'app/percona/shared/helpers/api';

import { ServerInfo } from '../types';

import perconaAddDBCluster from './addDBCluster/addDBCluster';
import perconaBackupLocations from './backupLocations';
import perconaDBClustersReducer from './dbClusters/dbClusters';
import perconaK8SCluster from './k8sCluster/k8sCluster';
import servicesReducer from './services';
import tourReducer from './tour/tour';
import perconaUserReducers from './user/user';

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
};

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
  (args: { body: Partial<SettingsAPIChangePayload>; token?: CancelToken }, thunkAPI): Promise<Settings | undefined> =>
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
          const settings = await SettingsService.setSettings(args.body, args.token);
          await thunkAPI.dispatch(fetchSettingsAction({ usedPassword: password, testEmail }));
          return settings;
        })()
      ),
      {
        successMessage: 'Settings updated',
      }
    )
);

const toKubernetesListModel = (
  response: KubernetesListAPI,
  checkUpdateResponse: CheckOperatorUpdateAPI
): Kubernetes[] => (response.kubernetes_clusters ?? []).map(toKubernetesModel(checkUpdateResponse));

const toKubernetesModel =
  (checkUpdateResponse: CheckOperatorUpdateAPI) =>
  ({ kubernetes_cluster_name: kubernetesClusterName, operators, status }: KubernetesAPI): Kubernetes => ({
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

export interface PerconaDBaaSState {
  selectedKubernetesCluster: Kubernetes | null;
}

export const initialDBaaSState: PerconaDBaaSState = {
  selectedKubernetesCluster: null,
};

const perconaDBaaSSlice = createSlice({
  name: 'perconaDBaaS',
  initialState: initialDBaaSState,
  reducers: {
    selectKubernetesCluster: (state, action: PayloadAction<Kubernetes | null>): PerconaDBaaSState => ({
      ...state,
      selectedKubernetesCluster: action.payload,
    }),
  },
});

export const { selectKubernetesCluster } = perconaDBaaSSlice.actions;
export const perconaDBaaSReducers = perconaDBaaSSlice.reducer;

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
        const { pmm_server_id = '', pmm_server_name = '' } = await PlatformService.getServerInfo();

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
        const { host } = (await api.get('/graph/percona-api/saas-host', true)) as { host: string };
        thunkAPI.dispatch(setServerSaasHost(host));
      })()
    )
);

export const fetchTemplatesAction = createAsyncThunk(
  'percona/fetchTemplates',
  async (): Promise<TemplatesList> =>
    withSerializedError(
      AlertRuleTemplateService.list({
        page_params: {
          index: 0,
          page_size: 100,
        },
      })
    )
);

const kubernetesReducer = createAsyncSlice('kubernetes', fetchKubernetesAction).reducer;
const deleteKubernetesReducer = createAsyncSlice('deleteKubernetes', deleteKubernetesAction).reducer;
const installKubernetesOperatorReducer = createAsyncSlice(
  'instalKuberneteslOperator',
  instalKuberneteslOperatorAction
).reducer;
const settingsReducer = createAsyncSlice('settings', fetchSettingsAction, initialSettingsState).reducer;
const updateSettingsReducer = createAsyncSlice('updateSettings', updateSettingsAction).reducer;
const templatesReducer = createAsyncSlice('templates', fetchTemplatesAction).reducer;

export default {
  percona: combineReducers({
    settings: settingsReducer,
    updateSettings: updateSettingsReducer,
    user: perconaUserReducers,
    dbaas: perconaDBaaSReducers,
    kubernetes: kubernetesReducer,
    deleteKubernetes: deleteKubernetesReducer,
    addKubernetes: perconaK8SCluster,
    addDBCluster: perconaAddDBCluster,
    installKubernetesOperator: installKubernetesOperatorReducer,
    dbClusters: perconaDBClustersReducer,
    server: perconaServerReducers,
    templates: templatesReducer,
    services: servicesReducer,
    backupLocations: perconaBackupLocations,
    tour: tourReducer,
  }),
};
