import { useMemo, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';

import { useSelector } from 'app/types';

import { getDBaaS } from '../../../../../shared/core/selectors';
import { Kubernetes } from '../../../Kubernetes/Kubernetes.types';
import { DBCluster, DBClusterPayload } from '../../DBCluster.types';
import { DB_CLUSTER_INVENTORY_URL } from '../EditDBClusterPage.constants';
import { AddDBClusterFormValues, DBClusterPageMode, UpdateDBClusterFormValues } from '../EditDBClusterPage.types';
import { getAddInitialValues, getDBClusterConfiguration, getEditInitialValues } from '../EditDBClusterPage.utils';

interface EditDBClusterPageDefaultValuesProps {
  kubernetes: Kubernetes[] | undefined;
  mode: DBClusterPageMode;
}

export const useEditDBClusterPageDefaultValues = ({
  kubernetes,
  mode,
}: EditDBClusterPageDefaultValuesProps): [
  AddDBClusterFormValues | UpdateDBClusterFormValues | undefined,
  DBCluster | null
] => {
  const history = useHistory();
  const { selectedKubernetesCluster: preSelectedKubernetesCluster, selectedDBCluster } = useSelector(getDBaaS);
  const [configuration, setConfiguration] = useState<DBClusterPayload | undefined>(undefined);

  useEffect(() => {
    if (mode === 'edit' && selectedDBCluster) {
      getDBClusterConfiguration(selectedDBCluster).then(setConfiguration);
    }
  }, [mode, selectedDBCluster]);

  const initialValues = useMemo(() => {
    if (mode === 'create') {
      return kubernetes?.length ? getAddInitialValues(kubernetes, preSelectedKubernetesCluster) : undefined;
    }
    if (mode === 'edit' && selectedDBCluster) {
      return getEditInitialValues(selectedDBCluster, configuration);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, kubernetes, mode, preSelectedKubernetesCluster, selectedDBCluster]);

  if (mode !== 'create' && (mode !== 'edit' || !selectedDBCluster)) {
    history.push(DB_CLUSTER_INVENTORY_URL);
  }

  return [initialValues, selectedDBCluster];
};
