import { Operators } from '../DBCluster/AddDBClusterModal/DBClusterBasicOptions/DBClusterBasicOptions.types';
import { ComponentToUpdate } from './Kubernetes.types';

export const OPERATOR_COMPONENT_TO_UPDATE_MAP = {
  [Operators.xtradb]: ComponentToUpdate.pxc,
  [Operators.psmdb]: ComponentToUpdate.psmdb,
};
