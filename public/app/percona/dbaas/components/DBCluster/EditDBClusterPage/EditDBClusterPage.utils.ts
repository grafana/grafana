import { DATABASE_LABELS } from '../../../../shared/core';
import { Kubernetes } from '../../Kubernetes/Kubernetes.types';
import { getActiveOperators, getDatabaseOptionFromOperator } from '../../Kubernetes/Kubernetes.utils';
import { DBCluster } from '../DBCluster.types';

import {
  DEFAULT_SIZES,
  INITIAL_VALUES,
  MIN_NODES,
} from './DBClusterAdvancedOptions/DBClusterAdvancedOptions.constants';
import { DBClusterResources, DBClusterTopology } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions.types';
import { getKubernetesOptions } from './DBClusterBasicOptions/DBClusterBasicOptions.utils';
import { AddDBClusterFields, AddDBClusterFormValues, EditDBClusterFormValues } from './EditDBClusterPage.types';

export const getAddInitialValues = (
  kubernetes: Kubernetes[],
  preSelectedCluster: Kubernetes | null
): AddDBClusterFormValues => {
  const activeOperators = getActiveOperators(preSelectedCluster ? [preSelectedCluster] : kubernetes);

  const initialValues: AddDBClusterFormValues = {
    ...INITIAL_VALUES,
    [AddDBClusterFields.databaseType]:
      activeOperators.length === 1
        ? getDatabaseOptionFromOperator(activeOperators[0])
        : { value: undefined, label: undefined },
  };

  if (kubernetes.length > 0) {
    const kubernetesOptions = getKubernetesOptions(preSelectedCluster ? [preSelectedCluster] : kubernetes);
    const initialCluster = kubernetesOptions.length > 0 && kubernetesOptions[0];
    if (initialCluster) {
      initialValues[AddDBClusterFields.kubernetesCluster] = initialCluster;
      if (activeOperators.length > 0) {
        const databaseDefaultOperator = getDatabaseOptionFromOperator(activeOperators[0]);
        initialValues[AddDBClusterFields.databaseType] = databaseDefaultOperator;
        initialValues[AddDBClusterFields.name] = `${databaseDefaultOperator?.value}-${generateUID()}`;
      }
    }
  }
  return initialValues;
};

export const generateUID = (): string => {
  const firstPart = ('000' + ((Math.random() * 46656) | 0).toString(36)).slice(-3);
  const secondPart = ('000' + ((Math.random() * 46656) | 0).toString(36)).slice(-3);
  return firstPart + secondPart;
};

export const getEditInitialValues = (selectedDBCluster: DBCluster): EditDBClusterFormValues => {
  const isCluster = selectedDBCluster.clusterSize > 1;
  const clusterParameters: EditDBClusterFormValues = {
    topology: isCluster ? DBClusterTopology.cluster : DBClusterTopology.single,
    nodes: isCluster ? selectedDBCluster.clusterSize : MIN_NODES,
    single: 1,
    databaseType: {
      value: selectedDBCluster.databaseType,
      label: DATABASE_LABELS[selectedDBCluster.databaseType],
    },
    cpu: selectedDBCluster.cpu,
    disk: selectedDBCluster.disk,
    memory: selectedDBCluster.memory,
  };
  const isMatchSize = (type: DBClusterResources) =>
    DEFAULT_SIZES[type].cpu === selectedDBCluster.cpu &&
    DEFAULT_SIZES[type].memory === selectedDBCluster.memory &&
    DEFAULT_SIZES[type].disk === selectedDBCluster.disk;

  if (isMatchSize(DBClusterResources.small)) {
    clusterParameters.resources = DBClusterResources.small;
  } else if (isMatchSize(DBClusterResources.medium)) {
    clusterParameters.resources = DBClusterResources.medium;
  } else if (isMatchSize(DBClusterResources.large)) {
    clusterParameters.resources = DBClusterResources.large;
  } else {
    clusterParameters.resources = DBClusterResources.custom;
  }

  return clusterParameters;
};
