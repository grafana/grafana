import { SelectableValue } from '@grafana/data';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';

import { DBClusterDefaultResources } from '../../EditDBClusterPage/DBClusterAdvancedOptions/DBClusterAdvancedOptions.types';

import { DBClusterTopology, DBClusterResources } from './DBClusterAdvancedOptions.types';

export const TOPOLOGY_OPTIONS: SelectableValue[] = [
  { value: DBClusterTopology.cluster, label: Messages.dbcluster.addModal.topology.cluster },
  { value: DBClusterTopology.single, label: Messages.dbcluster.addModal.topology.single },
];

export const RESOURCES_OPTIONS: SelectableValue[] = [
  { value: DBClusterResources.small, label: Messages.dbcluster.addModal.resources.small },
  { value: DBClusterResources.medium, label: Messages.dbcluster.addModal.resources.medium },
  { value: DBClusterResources.large, label: Messages.dbcluster.addModal.resources.large },
  { value: DBClusterResources.custom, label: Messages.dbcluster.addModal.resources.custom },
];

export const DEFAULT_SIZES: DBClusterDefaultResources = {
  small: {
    memory: 2,
    cpu: 1,
    disk: 25,
  },
  medium: {
    memory: 8,
    cpu: 4,
    disk: 100,
  },
  large: {
    memory: 32,
    cpu: 8,
    disk: 500,
  },
};

export const MIN_NODES = 3;
export const MIN_RESOURCES = 0.1;
