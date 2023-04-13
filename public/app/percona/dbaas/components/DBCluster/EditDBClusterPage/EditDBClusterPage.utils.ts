import { logger } from '@percona/platform-core';

import { DATABASE_LABELS } from '../../../../shared/core';
import { Kubernetes } from '../../Kubernetes/Kubernetes.types';
import { getActiveOperators, getDatabaseOptionFromOperator } from '../../Kubernetes/Kubernetes.utils';
import { DBCluster, DBClusterPayload } from '../DBCluster.types';
import { newDBClusterService } from '../DBCluster.utils';

import {
  DEFAULT_SIZES,
  INITIAL_VALUES,
  MIN_NODES,
} from './DBClusterAdvancedOptions/DBClusterAdvancedOptions.constants';
import { DBClusterResources } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions.types';
import { BasicOptionsFields } from './DBClusterBasicOptions/DBClusterBasicOptions.types';
import { getKubernetesOptions } from './DBClusterBasicOptions/DBClusterBasicOptions.utils';
import { AddDBClusterFormValues, UpdateDBClusterFormValues } from './EditDBClusterPage.types';

export const getAddInitialValues = (
  kubernetes: Kubernetes[],
  preSelectedCluster: Kubernetes | null
): AddDBClusterFormValues => {
  const activeOperators = getActiveOperators(preSelectedCluster ? [preSelectedCluster] : kubernetes);

  const initialValues: AddDBClusterFormValues = {
    ...INITIAL_VALUES,
    [BasicOptionsFields.databaseType]:
      activeOperators.length === 1
        ? getDatabaseOptionFromOperator(activeOperators[0])
        : { value: undefined, label: undefined },
  };

  if (kubernetes.length > 0) {
    const kubernetesOptions = getKubernetesOptions(preSelectedCluster ? [preSelectedCluster] : kubernetes);
    const initialCluster = kubernetesOptions.length > 0 && kubernetesOptions[0];
    if (initialCluster) {
      initialValues[BasicOptionsFields.kubernetesCluster] = initialCluster;
      if (activeOperators.length > 0) {
        const databaseDefaultOperator = getDatabaseOptionFromOperator(activeOperators[0]);
        initialValues[BasicOptionsFields.databaseType] = databaseDefaultOperator;
        initialValues[BasicOptionsFields.name] = `${databaseDefaultOperator?.value}-${generateUID()}`;
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

export const getDBClusterConfiguration = async (selectedCluster: DBCluster): Promise<DBClusterPayload | undefined> => {
  try {
    const dbClusterService = newDBClusterService(selectedCluster.databaseType);
    const result = await dbClusterService.getClusterConfiguration(selectedCluster);
    return result;
  } catch (e) {
    logger.error(e);
  }
  return;
};

export const getEditInitialValues = (
  selectedDBCluster: DBCluster,
  configuration: DBClusterPayload | undefined
): UpdateDBClusterFormValues => {
  const { template, clusterSize, sourceRanges, databaseType, cpu, disk, memory } = selectedDBCluster;
  const isCluster = clusterSize > 1;
  const sourceRangesArray = sourceRanges?.map((item) => ({ sourceRange: item })) || [{ sourceRange: '' }];
  const storageClass = configuration?.params?.replicaset?.storage_class || configuration?.params?.pxc?.storage_class;
  const clusterParameters: UpdateDBClusterFormValues = {
    nodes: isCluster ? clusterSize : MIN_NODES,
    databaseType: {
      value: databaseType,
      label: DATABASE_LABELS[databaseType],
    },
    cpu,
    disk,
    memory,
    configuration: configuration?.params?.pxc?.configuration || configuration?.params?.replicaset?.configuration,
    expose: configuration?.exposed,
    internetFacing: configuration?.internet_facing,
    sourceRanges: sourceRangesArray,
    ...(storageClass && { storageClass: { label: storageClass, value: storageClass } }),
    ...(template && { template: { label: template.name, value: template.kind } }),
  };
  const isMatchSize = (type: DBClusterResources) =>
    DEFAULT_SIZES[type].cpu === cpu && DEFAULT_SIZES[type].memory === memory && DEFAULT_SIZES[type].disk === disk;

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
