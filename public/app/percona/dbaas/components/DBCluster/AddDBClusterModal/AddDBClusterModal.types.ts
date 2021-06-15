import { Kubernetes } from '../../Kubernetes/Kubernetes.types';

export interface AddDBClusterModalProps {
  kubernetes: Kubernetes[];
  isVisible: boolean;
  showMonitoringWarning?: boolean;
  setVisible: (value: boolean) => void;
  onDBClusterAdded: () => void;
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
