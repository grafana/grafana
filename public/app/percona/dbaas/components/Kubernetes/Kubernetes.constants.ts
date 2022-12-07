import { Databases } from 'app/percona/shared/core';

import { Operators } from '../DBCluster/EditDBClusterPage/DBClusterBasicOptions/DBClusterBasicOptions.types';

import { ComponentToUpdate, DatabaseComponentToUpdateMap } from './Kubernetes.types';

export const OPERATOR_COMPONENT_TO_UPDATE_MAP = {
  [Operators.pxc]: ComponentToUpdate.pxc,
  [Operators.psmdb]: ComponentToUpdate.psmdb,
};

export const DATABASE_COMPONENT_TO_UPDATE_MAP = {
  [Databases.mysql]: ComponentToUpdate.pxc,
  [Databases.mongodb]: ComponentToUpdate.psmdb,
} as DatabaseComponentToUpdateMap;

export const GET_KUBERNETES_CANCEL_TOKEN = 'getKubernetes';
export const DELETE_KUBERNETES_CANCEL_TOKEN = 'deleteKubernetes';
export const CHECK_OPERATOR_UPDATE_CANCEL_TOKEN = 'checkOperatorUpdate';
