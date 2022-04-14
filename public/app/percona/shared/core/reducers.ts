import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { withSerializedError } from 'app/features/alerting/unified/utils/redux';
import { Settings } from 'app/percona/settings/Settings.types';
import { api } from 'app/percona/shared/helpers/api';
import { ServerInfo } from './types';

export interface PerconaSettingsState extends Settings {
  isLoading: boolean;
}

export const initialSettingsState: PerconaSettingsState = {
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
  isLoading: true,
  isConnectedToPortal: false,
};

const perconaSettingsSlice = createSlice({
  name: 'perconaSettings',
  initialState: initialSettingsState,
  reducers: {
    setSettings: (state, action: PayloadAction<Partial<PerconaSettingsState>>): PerconaSettingsState => ({
      ...state,
      ...action.payload,
      isLoading: false,
    }),
    setSettingsLoading: (state, action: PayloadAction<boolean>): PerconaSettingsState => ({
      ...state,
      isLoading: action.payload,
    }),
  },
});

export const { setSettings, setSettingsLoading } = perconaSettingsSlice.actions;

export const perconaSettingsReducers = perconaSettingsSlice.reducer;

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

export const perconaUserReducers = perconaUserSlice.reducer;

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

export default {
  perconaSettings: perconaSettingsReducers,
  perconaUser: perconaUserReducers,
  perconaServer: perconaServerReducers,
};
