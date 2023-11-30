import { SelectableValue } from '@grafana/data';
import { Settings } from 'app/types';

export interface AuthProviderInfo {
  id: string;
  type: string;
  protocol: string;
  displayName: string;
  configPath?: string;
}

export type GetStatusHook = () => Promise<AuthProviderStatus>;

// Settings types common to the provider settings data when working with the API and forms
export type SSOProviderSettingsBase = {
  enabled: boolean;
  name: string;
  type: string;
  clientId: string;
  clientSecret: string;
  allowedDomains?: string;
};

// SSO data received from the API and sent to it
export type SSOProvider = {
  provider: string;
  settings: SSOProviderSettingsBase & {
    teamIds: string;
    allowedOrganizations: string;

    // Legacy fields
    configPath?: string;
  };
};

// SSO data format for storing in the forms
export type SSOProviderDTO = SSOProviderSettingsBase & {
  teamIds: Array<SelectableValue<string>>;
  allowedOrganizations: Array<SelectableValue<string>>;
};

export interface AuthConfigState {
  settings: Settings;
  providerStatuses: Record<string, AuthProviderStatus>;
  isLoading?: boolean;
  updateError?: SettingsError;
  warning?: SettingsError;
  providers: SSOProvider[];
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
