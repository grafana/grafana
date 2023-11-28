import { __awaiter } from "tslib";
import React, { useCallback, useEffect, useMemo } from 'react';
import { Form } from 'react-final-form';
import { useHistory } from 'react-router-dom';
import { Button, Icon, Tooltip, useStyles } from '@grafana/ui/src';
import { PasswordInputField } from 'app/percona/shared/components/Form/PasswordInput';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { TextareaInputField } from 'app/percona/shared/components/Form/TextareaInput';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { useDispatch, useSelector } from 'app/types';
import { FeatureLoader } from '../../../../shared/components/Elements/FeatureLoader';
import { PageSwitcher } from '../../../../shared/components/Elements/PageSwitcher/PageSwitcher';
import { useCancelToken } from '../../../../shared/components/hooks/cancelToken.hook';
import { useShowPMMAddressWarning } from '../../../../shared/components/hooks/showPMMAddressWarning';
import { addKubernetesAction, resetAddK8SClusterState, } from '../../../../shared/core/reducers/dbaas/k8sCluster/k8sCluster';
import { getAddKubernetes, getPerconaSettingFlag } from '../../../../shared/core/selectors';
import { Messages as DBaaSMessages } from '../../../DBaaS.messages';
import DBaaSPage from '../../DBaaSPage/DBaaSPage';
import { PMMServerUrlWarning } from '../../PMMServerURLWarning/PMMServerUrlWarning';
import { DELETE_KUBERNETES_CANCEL_TOKEN } from '../Kubernetes.constants';
import { AWS_CREDENTIALS_DOC_LINK, K8S_INVENTORY_URL } from './EditK8sClusterPage.constants';
import { Messages as K8sFormMessages } from './EditK8sClusterPage.messages';
import { getStyles } from './EditK8sClusterPage.styles';
import { onKubeConfigValueChange, pasteFromClipboard } from './EditK8sClusterPage.utils';
const { required } = validators;
const { pageTitle, awsAccessKeyIDLabel, awsAccessKeyIDTooltip, awsSecretAccessKeyLabel, awsSecretAccessKeyTooltip, paste, fields, genericRadioButton, eksRadioButton, isEKSRadioTooltip, } = K8sFormMessages;
const { dbaas, kubernetes } = DBaaSMessages;
export const EditK8sClusterPage = () => {
    const styles = useStyles(getStyles);
    const dispatch = useDispatch();
    const history = useHistory();
    const { result: addK8SClusterResult, loading: addK8SClusterLoading } = useSelector(getAddKubernetes);
    const [showPMMAddressWarning] = useShowPMMAddressWarning();
    const [generateToken] = useCancelToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const featureSelector = useCallback(getPerconaSettingFlag('dbaasEnabled'), []);
    const pageSwitcherValues = useMemo(() => [
        { name: 'isEKS', value: false, label: genericRadioButton },
        { name: 'isEKS', value: true, label: eksRadioButton },
    ], []);
    const addKubernetes = useCallback((cluster, setPMMAddress = false) => __awaiter(void 0, void 0, void 0, function* () {
        yield dispatch(addKubernetesAction({
            kubernetesToAdd: cluster,
            setPMMAddress,
            token: generateToken(DELETE_KUBERNETES_CANCEL_TOKEN),
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);
    useEffect(() => {
        if (addK8SClusterResult === 'ok') {
            history.push(K8S_INVENTORY_URL);
        }
        return () => {
            dispatch(resetAddK8SClusterState());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [addK8SClusterResult]);
    return (React.createElement(Form, { onSubmit: (values) => {
            addKubernetes(values, showPMMAddressWarning);
        }, mutators: {
            setKubeConfigAndName: ([configValue, nameValue], state, { changeValue }) => {
                changeValue(state, 'kubeConfig', () => configValue);
                changeValue(state, 'name', () => nameValue);
            },
        }, initialValues: { isEKS: false }, render: ({ handleSubmit, valid, pristine, form, values: { isEKS } }) => (React.createElement("form", { onSubmit: handleSubmit },
            React.createElement(DBaaSPage, { pageToolbarProps: {
                    title: pageTitle,
                    parent: dbaas,
                    titleHref: K8S_INVENTORY_URL,
                }, submitBtnProps: {
                    disabled: !valid || pristine,
                    loading: addK8SClusterLoading,
                }, pageHeader: kubernetes.addAction, pageName: "k8s-cluster", cancelUrl: K8S_INVENTORY_URL, featureLoaderProps: { featureName: DBaaSMessages.dbaas, featureSelector: featureSelector } },
                React.createElement(FeatureLoader, { featureName: dbaas, featureSelector: featureSelector },
                    showPMMAddressWarning && React.createElement(PMMServerUrlWarning, null),
                    React.createElement(React.Fragment, null,
                        React.createElement("div", { className: styles.radioGroup },
                            React.createElement(PageSwitcher, { values: pageSwitcherValues }),
                            React.createElement(Tooltip, { content: isEKSRadioTooltip },
                                React.createElement(Icon, { "data-testid": "eks-info-icon", name: "info-circle", className: styles.radioInfoIcon }))),
                        React.createElement(TextareaInputField, { name: "kubeConfig", label: React.createElement(React.Fragment, null,
                                React.createElement("div", null, fields.kubeConfig),
                                React.createElement(Button, { "data-testid": "kubernetes-paste-from-clipboard-button", variant: "primary", fill: "outline", onClick: () => {
                                        pasteFromClipboard(form.mutators.setKubeConfigAndName);
                                    }, type: "button", icon: "percona-asterisk" }, paste)), validators: [required], inputProps: {
                                onChange: (event) => {
                                    var _a;
                                    onKubeConfigValueChange((_a = event === null || event === void 0 ? void 0 : event.target) === null || _a === void 0 ? void 0 : _a.value, form.mutators.setKubeConfigAndName);
                                },
                            }, fieldClassName: styles.k8ConfigField }),
                        isEKS && (React.createElement(React.Fragment, null,
                            React.createElement(TextInputField, { name: "awsAccessKeyID", label: awsAccessKeyIDLabel, tooltipIcon: "info-circle", tooltipText: awsAccessKeyIDTooltip, tooltipLink: AWS_CREDENTIALS_DOC_LINK, validators: [required], fieldClassName: styles.awsField }),
                            React.createElement(PasswordInputField, { name: "awsSecretAccessKey", label: awsSecretAccessKeyLabel, tooltipIcon: "info-circle", tooltipText: awsSecretAccessKeyTooltip, tooltipLink: AWS_CREDENTIALS_DOC_LINK, validators: [required], fieldClassName: styles.awsField }))),
                        React.createElement(TextInputField, { name: "name", label: fields.clusterName, validators: [required], fieldClassName: styles.k8sField })))))) }));
};
export default EditK8sClusterPage;
//# sourceMappingURL=EditK8sClusterPage.js.map