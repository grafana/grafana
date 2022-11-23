/* eslint-disable @typescript-eslint/no-explicit-any */
import { Kubernetes } from '../../Kubernetes/Kubernetes.types';

import { DBClusterResources, DBClusterTopology } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions.types';
import { DatabaseOptionInitial, KubernetesOption } from './DBClusterBasicOptions/DBClusterBasicOptions.types';

export interface AddDBClusterModalProps {
  kubernetes: Kubernetes[];
  isVisible: boolean;
  setVisible: (value: boolean) => void;
  onSubmit: (values: Record<string, any>, showPMMAddressWarning: boolean) => void;
  preSelectedKubernetesCluster: Kubernetes | null;
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

export interface AddDbClusterFormValues {
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
