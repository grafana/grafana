import { __awaiter } from "tslib";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { useEffect, useState } from 'react';
import { logger } from 'app/percona/shared/helpers/logger';
import { DATABASE_OPERATORS } from '../../DBCluster/DBCluster.constants';
import { newDBClusterService } from '../../DBCluster/DBCluster.utils';
import { KubernetesOperatorStatus } from '../OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { buildDefaultFieldName, buildVersionsFieldName, componentsToOptions, findDefaultVersion, parseDefaultVersionsOptions, versionsToOptions, } from './ManageComponentsVersions.utils';
import { DEFAULT_SUFFIX } from './ManageComponentsVersionsModal.constants';
import { Messages } from './ManageComponentsVersionsModal.messages';
import { ManageComponentVersionsFields, SupportedComponents, } from './ManageComponentsVersionsModal.types';
export const useOperatorsComponentsVersions = (kubernetes) => {
    const [initialValues, setInitialValues] = useState({});
    const [operatorsOptions, setOperatorsOptions] = useState([]);
    const [componentOptions, setComponentOptions] = useState([]);
    const [possibleComponentOptions, setPossibleComponentOptions] = useState({});
    const [versionsOptions, setVersionsOptions] = useState([]);
    const [versionsFieldName, setVersionsFieldName] = useState('');
    const [defaultFieldName, setDefaultFieldName] = useState(DEFAULT_SUFFIX);
    const [loadingComponents, setLoadingComponents] = useState(false);
    useEffect(() => {
        const getComponents = () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const { operators, kubernetesClusterName } = kubernetes;
                const operatorsList = Object.entries(operators);
                let availableOperatorOptions = [];
                let possibleComponentOptions = {};
                let initialValues = {};
                setLoadingComponents(true);
                for (const [operator, { status }] of operatorsList) {
                    if (status === KubernetesOperatorStatus.ok) {
                        [availableOperatorOptions, possibleComponentOptions, initialValues] = yield getOperatorComponentsOptions(operator, kubernetesClusterName, availableOperatorOptions, possibleComponentOptions, initialValues);
                    }
                }
                const name = buildVersionsFieldName(initialValues);
                const defaultName = buildDefaultFieldName(initialValues);
                const selectedOperator = initialValues.operator.value;
                setComponentOptions(possibleComponentOptions[selectedOperator]);
                setOperatorsOptions(availableOperatorOptions);
                setPossibleComponentOptions(possibleComponentOptions);
                setVersionsOptions(initialValues[name]);
                setVersionsFieldName(name);
                setDefaultFieldName(defaultName);
                setInitialValues(initialValues);
            }
            catch (e) {
                logger.error(e);
            }
            finally {
                setLoadingComponents(false);
            }
        });
        getComponents();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return [
        initialValues,
        operatorsOptions,
        componentOptions,
        possibleComponentOptions,
        versionsOptions,
        versionsFieldName,
        defaultFieldName,
        loadingComponents,
        setComponentOptions,
        setVersionsOptions,
        setVersionsFieldName,
        setDefaultFieldName,
    ];
};
const getOperatorComponentsOptions = (operator, kubernetesClusterName, operatorOptions, componentOptions, initialValues) => __awaiter(void 0, void 0, void 0, function* () {
    const service = newDBClusterService(DATABASE_OPERATORS[operator]);
    const components = yield service.getComponents(kubernetesClusterName);
    const operatorVersion = components.versions[0];
    const options = componentsToOptions(operatorVersion.matrix);
    const newComponentOptions = Object.assign(Object.assign({}, componentOptions), { [operator]: options });
    const newOperatorOptions = [
        ...operatorOptions,
        {
            name: operator,
            value: operator,
            label: Messages.operatorLabel[operator](operatorVersion.operator),
        },
    ];
    const newInitialValues = buildInitialValues(initialValues, operator, operatorVersion, newOperatorOptions, options);
    return [newOperatorOptions, newComponentOptions, newInitialValues];
});
const buildInitialValues = (initialValues, operator, operatorVersion, operatorOptions, componentOptions) => {
    const newInitialValues = {};
    if (Object.keys(initialValues).length === 0) {
        newInitialValues[ManageComponentVersionsFields.operator] = operatorOptions[0];
        newInitialValues[ManageComponentVersionsFields.component] = componentOptions[0];
    }
    Object.keys(SupportedComponents).forEach((key) => {
        const versions = operatorVersion.matrix[key];
        if (versions) {
            const versionsOptions = versionsToOptions(versions);
            newInitialValues[`${operator}${key}`] = versionsOptions;
            newInitialValues[`${operator}${key}${DEFAULT_SUFFIX}`] = parseDefaultVersionsOptions([
                findDefaultVersion(versionsOptions),
            ])[0];
        }
    });
    return Object.assign(Object.assign({}, initialValues), newInitialValues);
};
//# sourceMappingURL=ManageComponentsVersions.hooks.js.map