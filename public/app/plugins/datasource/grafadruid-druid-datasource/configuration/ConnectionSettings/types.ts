import { KeyValue } from '@grafana/data';

export interface ConnectionSettings {
  url?: string;
  retryableRetryMax?: number;
  retryableRetryWaitMin?: number;
  retryableRetryWaitMax?: number;
  basicAuth?: boolean;
  basicAuthUser?: string;
  skipTls?: boolean;
}
export interface ConnectionSecretSettings {
  basicAuthPassword?: string;
}
export interface ConnectionSettingsOptions {
  settings: ConnectionSettings;
  secretSettings: ConnectionSecretSettings;
  secretSettingsFields: KeyValue<boolean>;
}

export interface ConnectionSettingsProps {
  options: ConnectionSettingsOptions;
  onOptionsChange: (options: ConnectionSettingsOptions) => void;
}
