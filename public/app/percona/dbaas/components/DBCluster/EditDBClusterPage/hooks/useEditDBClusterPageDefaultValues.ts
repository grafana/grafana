import { useMemo } from 'react';
import { useSelector } from 'react-redux';

import { getDBaaS } from '../../../../../shared/core/selectors';
import { Kubernetes } from '../../../Kubernetes/Kubernetes.types';
import { AddDbClusterFormValues } from '../EditDBClusterPage.types';
import { getInitialValues } from '../EditDBClusterPage.utils';

interface EditDBClusterPageDefaultValuesProps {
  kubernetes: Kubernetes[] | undefined;
}

export const useEditDBClusterPageDefaultValues = ({
  kubernetes,
}: EditDBClusterPageDefaultValuesProps): [AddDbClusterFormValues | undefined] => {
  const { selectedKubernetesCluster: preSelectedKubernetesCluster } = useSelector(getDBaaS);

  // TODO check of edit fields will be added in other branch

  const initialValues = useMemo(
    () => (kubernetes?.length ? getInitialValues(kubernetes, preSelectedKubernetesCluster) : undefined),
    [kubernetes, preSelectedKubernetesCluster]
  );

  return [initialValues];
};
