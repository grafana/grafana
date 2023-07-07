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
  configuredInIni: boolean;
  enabledInUI: boolean;
  configuredInUI?: boolean;
}

export interface SettingsError {
  message: string;
  errors: string[];
}
