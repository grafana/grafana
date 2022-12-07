import { Kubernetes } from '../../Kubernetes/Kubernetes.types';
import { getActiveOperators, getDatabaseOptionFromOperator } from '../../Kubernetes/Kubernetes.utils';

import { INITIAL_VALUES } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions.constants';
import { getKubernetesOptions } from './DBClusterBasicOptions/DBClusterBasicOptions.utils';
import { AddDBClusterFields, AddDbClusterFormValues } from './EditDBClusterPage.types';

export const getInitialValues = (
  kubernetes: Kubernetes[],
  preSelectedCluster: Kubernetes | null
): AddDbClusterFormValues => {
  const activeOperators = getActiveOperators(preSelectedCluster ? [preSelectedCluster] : kubernetes);

  const initialValues: AddDbClusterFormValues = {
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
