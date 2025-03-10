/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { combineReducers, createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CancelToken } from 'axios';

import { config } from '@grafana/runtime';
import { createAsyncSlice, withAppEvents, withSerializedError } from 'app/features/alerting/unified/utils/redux';
import { AlertRuleTemplateService } from 'app/percona/integrated-alerting/components/AlertRuleTemplate/AlertRuleTemplate.service';
import { TemplatesList } from 'app/percona/integrated-alerting/components/AlertRuleTemplate/AlertRuleTemplate.types';
import { SettingsService } from 'app/percona/settings/Settings.service';
import { Settings, SettingsAPIChangePayload } from 'app/percona/settings/Settings.types';
import { PlatformService } from 'app/percona/settings/components/Platform/Platform.service';
import { api } from 'app/percona/shared/helpers/api';
import { uiEventsReducer } from 'app/percona/ui-events/reducer';

import { isPmmAdmin } from '../../helpers/permissions';
import { ServerInfo } from '../types';

import advisorsReducers from './advisors/advisors';
import perconaBackupLocations from './backups/backupLocations';
import navigationReducer from './navigation';
import nodesReducer from './nodes';
import pmmDumpsReducers from './pmmDump/pmmDump';
import rolesReducers from './roles/roles';
import servicesReducer from './services';
import tourReducer from './tour/tour';
import updatesReducers from './updates';
import perconaUserReducers from './user/user';
import usersReducers from './users/users';

const initialSettingsState: Settings = {
  updatesEnabled: false,
  telemetryEnabled: false,
  backupEnabled: false,
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
  advisorEnabled: false,
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
  advisorRunIntervals: {
    rareInterval: '10s',
    standardInterval: '10s',
    frequentInterval: '10s',
  },
  isConnectedToPortal: false,
  defaultRoleId: 1,
  enableAccessControl: false,
};

export const fetchSettingsAction = createAsyncThunk(
  'percona/fetchSettings',
  (
    args: { usedPassword: string; testEmail: string } | undefined = { usedPassword: '', testEmail: '' }
  ): Promise<Settings> =>
    withSerializedError(
      (async () => {
        const settings = isPmmAdmin(config.bootData.user)
          ? await SettingsService.getSettings(undefined, true)
          : await SettingsService.getReadonlySettings(undefined, true);

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
          const settings = await SettingsService.setSettings(args.body, args.token, true);
          await thunkAPI.dispatch(fetchSettingsAction({ usedPassword: password, testEmail }));
          return settings;
        })()
      ),
      {
        successMessage: 'Settings updated',
      }
    )
);

export interface PerconaServerState extends ServerInfo {
  saasHost: string;
}

export const initialServerState: PerconaServerState = {
  serverName: '',
  serverId: '',
  saasHost: 'https://portal.percona.com',
  serverTelemetryId: '',
};

const perconaServerSlice = createSlice({
  name: 'perconaServer',
  initialState: initialServerState,
  reducers: {
    setServerInfo: (state, action: PayloadAction<ServerInfo>): PerconaServerState => ({
      ...state,
      serverName: action.payload.serverName,
      serverId: action.payload.serverId,
      serverTelemetryId: action.payload.serverTelemetryId,
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
        const {
          pmm_server_id = '',
          pmm_server_name = '',
          pmm_server_telemetry_id = '',
        } = await PlatformService.getServerInfo();

        thunkAPI.dispatch(
          setServerInfo({
            serverName: pmm_server_name,
            serverId: pmm_server_id,
            serverTelemetryId: pmm_server_telemetry_id,
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

const settingsReducer = createAsyncSlice('settings', fetchSettingsAction, initialSettingsState).reducer;
const updateSettingsReducer = createAsyncSlice('updateSettings', updateSettingsAction).reducer;
const templatesReducer = createAsyncSlice('templates', fetchTemplatesAction).reducer;

export default {
  // Extend grafana navBarTree
  navBarTree: navigationReducer,
  percona: combineReducers({
    settings: settingsReducer,
    updateSettings: updateSettingsReducer,
    user: perconaUserReducers,
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
    pmmDumps: pmmDumpsReducers,
    updates: updatesReducers,
  }),
};
