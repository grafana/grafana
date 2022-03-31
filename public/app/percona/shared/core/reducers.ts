import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Settings } from 'app/percona/settings/Settings.types';

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

export default {
  perconaSettings: perconaSettingsReducers,
  perconaUser: perconaUserReducers,
};
