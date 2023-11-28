import { __awaiter } from "tslib";
import React from 'react';
import { Field, Form } from 'react-final-form';
import { AppEvents } from '@grafana/data';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { LoaderButton } from 'app/percona/shared/components/Elements/LoaderButton';
import { Modal } from 'app/percona/shared/components/Elements/Modal';
import { Overlay } from 'app/percona/shared/components/Elements/Overlay';
import { SelectFieldAdapter } from 'app/percona/shared/components/Form/FieldAdapters/FieldAdapters';
import { MultiCheckboxField } from 'app/percona/shared/components/Form/MultiCheckbox/MultiCheckboxField';
import { logger } from 'app/percona/shared/helpers/logger';
import { DATABASE_OPERATORS } from '../../DBCluster/DBCluster.constants';
import { newDBClusterService } from '../../DBCluster/DBCluster.utils';
import { KubernetesOperatorStatus } from '../OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { useOperatorsComponentsVersions } from './ManageComponentsVersions.hooks';
import { buildDefaultFieldName, buildVersionsFieldName, defaultRequired, findRecommendedVersions, getDefaultOptions, parseDefaultVersionsOptions, requiredVersions, } from './ManageComponentsVersions.utils';
import { Messages } from './ManageComponentsVersionsModal.messages';
import { getStyles } from './ManageComponentsVersionsModal.styles';
import { ManageComponentVersionsFields, } from './ManageComponentsVersionsModal.types';
export const ManageComponentsVersionsModal = ({ selectedKubernetes, isVisible, setVisible, setSelectedCluster, }) => {
    const styles = useStyles(getStyles);
    const [initialValues, operatorsOptions, componentOptions, possibleComponentOptions, versionsOptions, versionsFieldName, defaultFieldName, loadingComponents, setComponentOptions, setVersionsOptions, setVersionsFieldName, setDefaultFieldName,] = useOperatorsComponentsVersions(selectedKubernetes);
    const onChangeComponent = (values, change) => (component) => {
        const newValues = Object.assign(Object.assign({}, values), { [ManageComponentVersionsFields.component]: component });
        const name = buildVersionsFieldName(newValues);
        const defaultName = buildDefaultFieldName(newValues);
        const options = values[name];
        setVersionsFieldName(name);
        setVersionsOptions(options);
        setDefaultFieldName(defaultName);
        change(ManageComponentVersionsFields.component, component);
        change(defaultName, values[defaultName]);
    };
    const onChangeOperator = (values, change) => (operator) => {
        const newComponentOptions = possibleComponentOptions[operator.value];
        const newValues = Object.assign(Object.assign({}, values), { [ManageComponentVersionsFields.operator]: operator, [ManageComponentVersionsFields.component]: newComponentOptions[0] });
        const name = buildVersionsFieldName(newValues);
        const defaultName = buildDefaultFieldName(newValues);
        const options = values[name];
        setComponentOptions(newComponentOptions);
        setVersionsFieldName(name);
        setVersionsOptions(options);
        setDefaultFieldName(defaultName);
        change(ManageComponentVersionsFields.component, newComponentOptions[0]);
        change(ManageComponentVersionsFields.operator, operator);
        change(defaultName, values[defaultName]);
    };
    const onSubmit = (values) => __awaiter(void 0, void 0, void 0, function* () {
        const { operators, kubernetesClusterName } = selectedKubernetes;
        const operatorsList = Object.entries(operators);
        try {
            for (const [operator, { status }] of operatorsList) {
                if (status === KubernetesOperatorStatus.ok) {
                    const service = newDBClusterService(DATABASE_OPERATORS[operator]);
                    yield service.setComponents(kubernetesClusterName, values);
                }
            }
            setVisible(false);
            appEvents.emit(AppEvents.alertSuccess, [Messages.success]);
        }
        catch (e) {
            logger.error(e);
        }
        finally {
            setSelectedCluster(null);
        }
    });
    return (React.createElement(Modal, { title: Messages.title, isVisible: isVisible, onClose: () => setVisible(false) },
        React.createElement(Overlay, { isPending: loadingComponents },
            React.createElement(Form, { initialValues: initialValues, onSubmit: onSubmit, render: ({ handleSubmit, valid, submitting, form, values, }) => {
                    const name = buildVersionsFieldName(values);
                    const defaultName = buildDefaultFieldName(values);
                    const defaultVersionOptions = getDefaultOptions(values);
                    const defaultVersion = defaultName ? values[defaultName] : undefined;
                    const showDefaultErrorOnBlur = !defaultName && defaultVersionOptions.length === 0;
                    const selectedVersions = (name ? values[name] : []);
                    const isDefaultDisabled = defaultVersion
                        ? selectedVersions.find(({ name, value }) => name === defaultVersion.name && !value)
                        : false;
                    // clear default version when the version is disabled
                    if (defaultName && defaultVersion && isDefaultDisabled) {
                        form.change(defaultName, {
                            value: undefined,
                            label: undefined,
                        });
                    }
                    return (React.createElement("form", { onSubmit: handleSubmit },
                        React.createElement(React.Fragment, null,
                            React.createElement(Field, { dataTestId: "kubernetes-operator", name: ManageComponentVersionsFields.operator, label: Messages.fields.operator, options: operatorsOptions, component: SelectFieldAdapter, disabled: !valid, onChange: onChangeOperator(values, form.change) }),
                            React.createElement(Field, { dataTestId: "kubernetes-component", name: ManageComponentVersionsFields.component, label: Messages.fields.component, options: componentOptions, component: SelectFieldAdapter, disabled: !valid, onChange: onChangeComponent(values, form.change) }),
                            React.createElement(MultiCheckboxField, { name: versionsFieldName, className: styles.versionsWrapper, label: Messages.fields.versions, initialOptions: versionsOptions, recommendedOptions: findRecommendedVersions(versionsOptions), recommendedLabel: Messages.recommended, validators: [requiredVersions] }),
                            React.createElement(Field, { dataTestId: "kubernetes-default-version", className: styles.defaultWrapper, name: defaultFieldName, label: Messages.fields.default, options: parseDefaultVersionsOptions(defaultVersionOptions), showErrorOnBlur: showDefaultErrorOnBlur, component: SelectFieldAdapter, validate: defaultRequired }),
                            React.createElement(HorizontalGroup, { justify: "space-between", spacing: "md" },
                                React.createElement(Button, { variant: "secondary", size: "md", onClick: () => setVisible(false), "data-testid": "kubernetes-components-versions-cancel" }, Messages.cancel),
                                React.createElement(LoaderButton, { variant: "primary", size: "md", disabled: !valid, loading: submitting, "data-testid": "kubernetes-components-versions-save", type: "submit" }, Messages.save)))));
                } }))));
};
//# sourceMappingURL=ManageComponentsVersionsModal.js.map