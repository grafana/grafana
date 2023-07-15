import { Settings } from 'app/types';

export interface AuthConfigState {
  settings: Settings;
  providerStatuses: Record<string, AuthProviderStatus>;
  isLoading?: boolean;
  updateError?: SettingsError;
  warning?: SettingsError;
}

export interface AuthProviderStatus {
  enabled: boolean;
  configured: boolean;
  configFoundInIniFile?: boolean;
}

export interface SettingsError {
  message: string;
  errors: string[];
}
