import { useHistory } from 'react-router-dom';
import { DB_CLUSTER_CREATION_URL, DB_CLUSTER_EDIT_URL } from '../EditDBClusterPage.constants';
export const useDefaultMode = () => {
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
//# sourceMappingURL=useDefaultMode.js.map