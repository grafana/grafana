import { GrafanaEdition } from '@grafana/data/internal';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

export function isOpenSourceEdition() {
  return config.buildInfo.edition === GrafanaEdition.OpenSource;
}

export function isAdmin() {
  return contextSrv.hasRole('Admin') || contextSrv.isGrafanaAdmin;
}

export function isLocalDevEnv() {
  return config.buildInfo.env === 'development';
}
