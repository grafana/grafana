import React from 'react';
import { KubernetesOperatorStatus } from '../../../Kubernetes/OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { OptionContent } from '../../OptionContent/OptionContent';
import { Messages } from '../EditDBClusterPage.messages';
import { DatabaseOperators, OPERATORS } from './DBClusterBasicOptions.constants';
export const kubernetesClusterNameValidator = (value) => {
    const clusterNameRegexp = /^[a-z]([-a-z0-9]*[a-z0-9])?$/;
    return clusterNameRegexp.test(value) ? undefined : Messages.validationMessages.clusterName;
};
const KubernetesOption = ({ disabledOperators, availableOperators, kubernetesClusterName, }) => (React.createElement(OptionContent, { title: kubernetesClusterName, description: disabledOperators.length ? Messages.validationMessages.notInstalledOperator : '', tags: availableOperators.map((databaseType) => DatabaseOperators[databaseType]), disabledTags: disabledOperators.map((databaseType) => DatabaseOperators[databaseType]), dataTestId: "kubernetes-option" }));
export const getKubernetesOptions = (kubernetes) => kubernetes
    .map((kubernetesCluster) => {
    const { kubernetesClusterName, operators } = kubernetesCluster;
    const availableOperators = OPERATORS.filter((databaseType) => operators[databaseType].status === KubernetesOperatorStatus.ok);
    const disabledOperators = OPERATORS.filter((databaseType) => operators[databaseType].status !== KubernetesOperatorStatus.ok);
    return {
        value: kubernetesClusterName,
        label: (React.createElement(KubernetesOption, { kubernetesClusterName: kubernetesClusterName, availableOperators: availableOperators, disabledOperators: disabledOperators })),
        operators,
        availableOperators,
    };
})
    .filter((operators) => operators.availableOperators.length);
export const optionRequired = (option) => option && option.label && option.value ? undefined : Messages.validationMessages.requiredField;
export const findDefaultDatabaseVersion = (versions) => versions.find((version) => version.default);
//# sourceMappingURL=DBClusterBasicOptions.utils.js.map