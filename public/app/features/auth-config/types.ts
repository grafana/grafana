import { ReactElement } from 'react';
import { Validate, UseFormSetValue } from 'react-hook-form';

import { IconName, SelectableValue } from '@grafana/data';
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
  allowAssignGrafanaAdmin?: boolean;
  allowSignUp?: boolean;
  apiUrl?: string;
  authStyle?: string;
  authUrl?: string;
  autoLogin?: boolean;
  clientAuthentication?: string;
  clientId: string;
  clientSecret: string;
  managedIdentityClientId?: string;
  federatedCredentialAudience?: string;
  emailAttributeName?: string;
  emailAttributePath?: string;
  emptyScopes?: boolean;
  enabled: boolean;
  extra?: Record<string, string>;
  groupsAttributePath?: string;
  hostedDomain?: string;
  icon?: IconName;
  name?: string;
  roleAttributePath?: string;
  roleAttributeStrict?: boolean;
  signoutRedirectUrl?: string;
  skipOrgRoleSync?: boolean;
  orgAttributePath?: string;
  teamIdsAttributePath?: string;
  teamsUrl?: string;
  tlsClientCa?: string;
  tlsClientCert?: string;
  tlsClientKey?: string;
  tlsSkipVerify?: boolean;
  tokenUrl?: string;
  type: string;
  usePkce?: boolean;
  useRefreshToken?: boolean;
  nameAttributePath?: string;
  loginAttributePath?: string;
  idTokenAttributeName?: string;
  defineAllowedGroups?: boolean;
  defineAllowedTeamsIds?: boolean;
  configureTLS?: boolean;
  tlsSkipVerifyInsecure?: boolean;
  // For Azure AD
  forceUseGraphApi?: boolean;
  // For Google
  validateHd?: boolean;
};

// SSO data received from the API and sent to it
export type SSOProvider = {
  id: string;
  provider: string;
  source: string;
  settings: SSOProviderSettingsBase & {
    teamIds: string;
    allowedOrganizations: string;
    allowedDomains?: string;
    allowedGroups?: string;
    scopes?: string;
    orgMapping?: string;
    serverDiscoveryUrl?: string;
  };
};

// SSO data format for storing in the forms
export type SSOProviderDTO = Partial<SSOProviderSettingsBase> & {
  teamIds: Array<SelectableValue<string>>;
  allowedOrganizations: Array<SelectableValue<string>>;
  allowedDomains?: Array<SelectableValue<string>>;
  allowedGroups?: Array<SelectableValue<string>>;
  scopes?: Array<SelectableValue<string>>;
  orgMapping?: Array<SelectableValue<string>>;
  serverDiscoveryUrl?: string;
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

// Data structure used to render form fields
export type FieldData = {
  label: string;
  type: string;
  description?: string | ReactElement;
  validation?: {
    required?: boolean;
    message?: string;
    validate?: Validate<SSOProviderDTO[keyof SSOProviderDTO], SSOProviderDTO>;
  };
  multi?: boolean;
  allowCustomValue?: boolean;
  options?: Array<SelectableValue<string>>;
  placeholder?: string;
  defaultValue?: SelectableValue<string>;
  hidden?: boolean;
  content?: (setValue: UseFormSetValue<SSOProviderDTO>) => ReactElement;
};

export type SSOSettingsField =
  | keyof SSOProvider['settings']
  | { name: keyof SSOProvider['settings']; dependsOn: keyof SSOProvider['settings']; hidden?: boolean };

export interface ServerDiscoveryFormData {
  url: string;
}
