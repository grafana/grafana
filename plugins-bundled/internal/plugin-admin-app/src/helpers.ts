import { config } from '@grafana/runtime';

export function isGrafanaAdmin(): boolean {
  return config.bootData.user.isGrafanaAdmin;
}
