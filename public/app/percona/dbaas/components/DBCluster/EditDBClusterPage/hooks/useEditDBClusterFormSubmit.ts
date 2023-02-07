import { useSelector, useDispatch } from 'app/types';

import { addDbClusterAction } from '../../../../../shared/core/reducers/dbaas/addDBCluster/addDBCluster';
import { updateDBClusterAction } from '../../../../../shared/core/reducers/dbaas/updateDBCluster/updateDBCluster';
import { getAddDbCluster, getDBaaS, getUpdateDbCluster } from '../../../../../shared/core/selectors';
import { ClusterSubmit, DBClusterFormSubmitProps } from '../EditDBClusterPage.types';

export const useEditDBClusterFormSubmit = ({
  mode,
  showPMMAddressWarning,
  settings,
}: DBClusterFormSubmitProps): [ClusterSubmit, boolean | undefined, string, 'error' | 'ok' | undefined] => {
  const dispatch = useDispatch();
  const { result, loading } = useSelector(mode === 'create' ? getAddDbCluster : getUpdateDbCluster);
  const { selectedDBCluster } = useSelector(getDBaaS);

  const addCluster = async (values: Record<string, any>) => {
    await dispatch(addDbClusterAction({ values, setPMMAddress: showPMMAddressWarning, settings }));
  };

  const editCluster = async (values: Record<string, any>) => {
    if (selectedDBCluster) {
      await dispatch(updateDBClusterAction({ values, selectedDBCluster }));
    }
  };

  if (mode === 'create') {
    return [addCluster, loading, 'Create', result];
  } else {
    return [editCluster, loading, 'Edit', result];
  }
};
