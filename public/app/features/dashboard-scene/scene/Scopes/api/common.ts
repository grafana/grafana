import { config } from '@grafana/runtime';

export const group = 'scope.grafana.app';
export const version = 'v0alpha1';
export const namespace = config.namespace ?? 'default';
