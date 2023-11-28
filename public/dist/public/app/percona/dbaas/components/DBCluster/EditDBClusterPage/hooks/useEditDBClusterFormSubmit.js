import { __awaiter } from "tslib";
import { useSelector, useDispatch } from 'app/types';
import { addDbClusterAction } from '../../../../../shared/core/reducers/dbaas/addDBCluster/addDBCluster';
import { updateDBClusterAction } from '../../../../../shared/core/reducers/dbaas/updateDBCluster/updateDBCluster';
import { getAddDbCluster, getDBaaS, getUpdateDbCluster } from '../../../../../shared/core/selectors';
export const useEditDBClusterFormSubmit = ({ mode, showPMMAddressWarning, settings, }) => {
    const dispatch = useDispatch();
    const { result, loading } = useSelector(mode === 'create' ? getAddDbCluster : getUpdateDbCluster);
    const { selectedDBCluster } = useSelector(getDBaaS);
    const addCluster = (values) => __awaiter(void 0, void 0, void 0, function* () {
        yield dispatch(addDbClusterAction({ values, setPMMAddress: showPMMAddressWarning, settings }));
    });
    const editCluster = (values) => __awaiter(void 0, void 0, void 0, function* () {
        if (selectedDBCluster) {
            yield dispatch(updateDBClusterAction({ values, selectedDBCluster }));
        }
    });
    if (mode === 'create') {
        return [addCluster, loading, 'Create', result];
    }
    else {
        return [editCluster, loading, 'Edit', result];
    }
};
//# sourceMappingURL=useEditDBClusterFormSubmit.js.map