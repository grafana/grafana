export const EXTRA_CONFIG_UID = '~grafana-with-extra-config';

export interface ExtraConfiguration {
  identifier: string;
  source?: string;
  createdAt?: string;
}

export interface AlertingConfigResponse {
  extra_config?: ExtraConfiguration[];
}

export function isExtraConfig(name: string): boolean {
  return name === EXTRA_CONFIG_UID;
}
