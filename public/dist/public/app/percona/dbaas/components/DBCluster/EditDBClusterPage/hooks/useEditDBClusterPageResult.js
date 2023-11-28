import { useSelector } from 'app/types';
import { getAddDbCluster, getUpdateDbCluster } from '../../../../../shared/core/selectors';
export const useEditDBClusterPageResult = (mode) => {
    const { result } = useSelector(mode === 'create' ? getAddDbCluster : getUpdateDbCluster);
    return [result];
};
//# sourceMappingURL=useEditDBClusterPageResult.js.map