import { Settings } from 'app/types';

export interface AuthProviderInfo {
  id: string;
  type: string;
  protocol: string;
  displayName: string;
  configPath?: string;
  needEnterpriseLicense?: boolean;
}

export type GetStatusHook = () => Promise<AuthProviderStatus>;

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
  name?: string;
  hide?: boolean;
  configFoundInIniFile?: boolean;
}

export interface SettingsError {
  message: string;
  errors: string[];
}
