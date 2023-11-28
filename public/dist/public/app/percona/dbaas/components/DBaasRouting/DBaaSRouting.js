import React, { useCallback, useMemo } from 'react';
import { Redirect } from 'react-router-dom';
import { Spinner, useStyles } from '@grafana/ui/src';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { getPerconaSettingFlag } from '../../../shared/core/selectors';
import { Messages } from '../../DBaaS.messages';
import { useKubernetesList } from '../../hooks/useKubernetesList';
import { DB_CLUSTER_INVENTORY_URL } from '../DBCluster/EditDBClusterPage/EditDBClusterPage.constants';
import { K8S_INVENTORY_URL } from '../Kubernetes/EditK8sClusterPage/EditK8sClusterPage.constants';
import { getStyles } from './DBaasRouting.styles';
export const DBaaSRouting = () => {
    const styles = useStyles(getStyles);
    const [kubernetes, kubernetesLoading] = useKubernetesList();
    const showLoading = useMemo(() => (kubernetesLoading && !kubernetes) || kubernetes === undefined, [kubernetesLoading, kubernetes]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const featureSelector = useCallback(getPerconaSettingFlag('dbaasEnabled'), []);
    return (React.createElement(FeatureLoader, { featureName: Messages.dbaas, featureSelector: featureSelector }, showLoading ? (React.createElement("div", { "data-testid": "dbaas-loading", className: styles.spinnerWrapper },
        React.createElement(Spinner, null))) : kubernetes && kubernetes.length > 0 ? (React.createElement(Redirect, { to: DB_CLUSTER_INVENTORY_URL })) : (React.createElement(Redirect, { to: K8S_INVENTORY_URL }))));
};
export default DBaaSRouting;
//# sourceMappingURL=DBaaSRouting.js.map