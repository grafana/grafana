import { Databases } from 'app/percona/shared/core';
import { Operators } from '../DBCluster/AddDBClusterModal/DBClusterBasicOptions/DBClusterBasicOptions.types';
import { ComponentToUpdate, DatabaseComponentToUpdateMap } from './Kubernetes.types';

export const OPERATOR_COMPONENT_TO_UPDATE_MAP = {
  [Operators.pxc]: ComponentToUpdate.pxc,
  [Operators.psmdb]: ComponentToUpdate.psmdb,
};

export const DATABASE_COMPONENT_TO_UPDATE_MAP = {
  [Databases.mysql]: ComponentToUpdate.pxc,
  [Databases.mongodb]: ComponentToUpdate.psmdb,
} as DatabaseComponentToUpdateMap;
