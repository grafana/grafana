import { config } from '@grafana/runtime';

export const getK8sNamespace = () => config.namespace;
