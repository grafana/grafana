/* eslint-disable @typescript-eslint/no-explicit-any */
import { SelectableValue } from '@grafana/data/src';

import { Kubernetes } from '../../Kubernetes/Kubernetes.types';

import { DBClusterResources, DBClusterTopology } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions.types';
import { DatabaseOptionInitial, KubernetesOption } from './DBClusterBasicOptions/DBClusterBasicOptions.types';

export type DBClusterPageMode = 'create' | 'edit' | 'list';

export interface EditDBClusterPageProps {
  kubernetes: Kubernetes[];
}

export enum AddDBClusterFields {
  name = 'name',
  kubernetesCluster = 'kubernetesCluster',
  databaseType = 'databaseType',
  databaseVersion = 'databaseVersion',
  topology = 'topology',
  nodes = 'nodes',
  single = 'single',
  resources = 'resources',
  memory = 'memory',
  cpu = 'cpu',
  disk = 'disk',
  expose = 'expose',
}

export enum EditDBClusterFields {
  name = 'name',
  kubernetesCluster = 'kubernetesCluster',
  databaseType = 'databaseType',
  topology = 'topology',
  nodes = 'nodes',
  single = 'single',
  resources = 'resources',
  memory = 'memory',
  cpu = 'cpu',
  disk = 'disk',
}

export interface AddDBClusterFormValues {
  [AddDBClusterFields.topology]: DBClusterTopology;
  [AddDBClusterFields.nodes]: number;
  [AddDBClusterFields.single]: number;
  [AddDBClusterFields.resources]: DBClusterResources;
  [AddDBClusterFields.memory]: number;
  [AddDBClusterFields.cpu]: number;
  [AddDBClusterFields.disk]: number;
  [AddDBClusterFields.databaseType]?: DatabaseOptionInitial;
  [AddDBClusterFields.kubernetesCluster]?: KubernetesOption;
  [AddDBClusterFields.name]?: string;
}

export interface EditDBClusterFormValues {
  [EditDBClusterFields.topology]?: string;
  [EditDBClusterFields.resources]?: DBClusterResources;
  [EditDBClusterFields.nodes]: number;
  [EditDBClusterFields.single]: number;
  [EditDBClusterFields.databaseType]: SelectableValue;
  [EditDBClusterFields.cpu]: number;
  [EditDBClusterFields.disk]: number;
  [EditDBClusterFields.memory]: number;
}

export interface DBClusterFormSubmitProps {
  mode: DBClusterPageMode;
  showPMMAddressWarning: boolean;
}

export type ClusterSubmit = (values: Record<string, any>) => Promise<void>;
