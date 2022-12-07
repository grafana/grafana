import { useHistory } from 'react-router-dom';

import { DB_CLUSTER_CREATION_URL, DB_CLUSTER_EDIT_URL } from '../EditDBClusterPage.constants';
import { DBClusterPageMode } from '../EditDBClusterPage.types';

export const useDefaultMode = (): DBClusterPageMode => {
  const history = useHistory();
  switch (history.location.pathname) {
    case DB_CLUSTER_CREATION_URL:
      return 'create';
    case DB_CLUSTER_EDIT_URL:
      return 'edit';
    default:
      return 'list';
  }
};
