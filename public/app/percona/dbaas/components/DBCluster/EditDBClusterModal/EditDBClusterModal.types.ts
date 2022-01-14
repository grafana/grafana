import { SelectableValue } from '@grafana/data';
import { DBCluster } from '../DBCluster.types';
import { DBClusterResources } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions.types';

export interface EditDBClusterModalProps {
  isVisible: boolean;
  setVisible: (value: boolean) => void;
  onDBClusterChanged: () => void;
  selectedCluster: DBCluster;
}

export interface EditDBClusterRenderProps {
  [EditDBClusterFields.topology]?: string;
  [EditDBClusterFields.resources]?: DBClusterResources;
  [EditDBClusterFields.nodes]: number;
  [EditDBClusterFields.single]: number;
  [EditDBClusterFields.databaseType]: SelectableValue;
  [EditDBClusterFields.cpu]: number;
  [EditDBClusterFields.disk]: number;
  [EditDBClusterFields.memory]: number;
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
