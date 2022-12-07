import { useSelector } from 'react-redux';

import { getAddDbCluster } from '../../../../../shared/core/selectors';
import { DBClusterPageMode } from '../EditDBClusterPage.types';

export const useEditDBClusterPageResult = (mode: DBClusterPageMode): [any] => {
  const { result } = useSelector(getAddDbCluster); // TODO mode === 'create'? getAddDbCluster/edit will be changes in other branch
  return [result];
};
