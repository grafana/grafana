/* eslint-disable @typescript-eslint/no-explicit-any */
import { Kubernetes } from '../../Kubernetes/Kubernetes.types';

export interface AddDBClusterModalProps {
  kubernetes: Kubernetes[];
  isVisible: boolean;
  setVisible: (value: boolean) => void;
  onSubmit: (values: Record<string, any>, showPMMAddressWarning: boolean) => void;
  initialValues: Record<string, any>;
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
