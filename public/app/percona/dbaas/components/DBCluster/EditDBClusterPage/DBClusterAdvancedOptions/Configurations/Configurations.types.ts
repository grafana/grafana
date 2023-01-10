import { Databases } from 'app/percona/shared/core';
export enum ConfigurationFields {
  storageClass = 'storageClass',
  configuration = 'configuration',
}

export interface ConfigurationProps {
  databaseType: Databases;
  k8sClusterName: string;
}
