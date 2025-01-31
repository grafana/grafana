import { config } from '@grafana/runtime';

export const getAPINamespace = () => config.namespace;
