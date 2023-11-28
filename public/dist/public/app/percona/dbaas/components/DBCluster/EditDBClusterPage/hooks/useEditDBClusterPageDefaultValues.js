import { useMemo, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useSelector } from 'app/types';
import { getDBaaS } from '../../../../../shared/core/selectors';
import { DB_CLUSTER_INVENTORY_URL } from '../EditDBClusterPage.constants';
import { getAddInitialValues, getDBClusterConfiguration, getEditInitialValues } from '../EditDBClusterPage.utils';
export const useEditDBClusterPageDefaultValues = ({ kubernetes, mode, }) => {
    const history = useHistory();
    const { selectedKubernetesCluster: preSelectedKubernetesCluster, selectedDBCluster } = useSelector(getDBaaS);
    const [configuration, setConfiguration] = useState(undefined);
    useEffect(() => {
        if (mode === 'edit' && selectedDBCluster) {
            getDBClusterConfiguration(selectedDBCluster).then(setConfiguration);
        }
    }, [mode, selectedDBCluster]);
    const initialValues = useMemo(() => {
        if (mode === 'create') {
            return (kubernetes === null || kubernetes === void 0 ? void 0 : kubernetes.length) ? getAddInitialValues(kubernetes, preSelectedKubernetesCluster) : undefined;
        }
        if (mode === 'edit' && selectedDBCluster) {
            return getEditInitialValues(selectedDBCluster, configuration);
        }
        return undefined;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [history, kubernetes, mode, preSelectedKubernetesCluster, selectedDBCluster, configuration]);
    if (mode !== 'create' && (mode !== 'edit' || !selectedDBCluster)) {
        history.push(DB_CLUSTER_INVENTORY_URL);
    }
    return [initialValues, selectedDBCluster];
};
//# sourceMappingURL=useEditDBClusterPageDefaultValues.js.map