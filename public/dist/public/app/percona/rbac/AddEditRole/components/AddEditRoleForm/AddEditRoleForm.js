import React, { useCallback, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useHistory } from 'react-router-dom';
import { Field, Input, PageToolbar, ToolbarButton, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import LabelsField from '../LabelsField';
import { Messages } from './AddEditRoleForm.messages';
import { getStyles } from './AddEditRoleForm.styles';
const AddEditRoleForm = ({ initialValues, isLoading, title, cancelLabel, onCancel, submitLabel, onSubmit, }) => {
    var _a, _b;
    const history = useHistory();
    const methods = useForm({
        defaultValues: initialValues,
    });
    const errors = methods.formState.errors;
    const styles = useStyles2(getStyles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const featureSelector = useCallback(getPerconaSettingFlag('enableAccessControl'), []);
    useEffect(() => {
        methods.reset(initialValues);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialValues]);
    const handleGoBack = () => {
        history.push('/roles');
    };
    return (React.createElement(FormProvider, Object.assign({}, methods),
        React.createElement(PageToolbar, { title: title, onGoBack: handleGoBack },
            React.createElement(ToolbarButton, { "data-testid": "add-edit-role-cancel", type: "button", onClick: onCancel }, cancelLabel),
            React.createElement(ToolbarButton, { "data-testid": "add-edit-role-submit", type: "submit", variant: "primary", onClick: methods.handleSubmit(onSubmit) }, submitLabel)),
        React.createElement(Page.Contents, { isLoading: isLoading, className: styles.pageContainer },
            React.createElement(FeatureLoader, { featureSelector: featureSelector },
                React.createElement("form", { onSubmit: methods.handleSubmit(onSubmit) },
                    React.createElement("div", { className: styles.page },
                        React.createElement(Field, { label: Messages.name.label, invalid: !!errors.title, error: (_a = errors.title) === null || _a === void 0 ? void 0 : _a.message },
                            React.createElement(Input, Object.assign({ "data-testid": "role-name-field" }, methods.register('title', { required: Messages.name.required }), { type: "text", placeholder: Messages.name.placeholder }))),
                        React.createElement(Field, { label: Messages.description.label, description: Messages.description.description },
                            React.createElement(Input, Object.assign({ "data-testid": "role-description-field" }, methods.register('description'), { type: "text", placeholder: Messages.description.placeholder }))),
                        React.createElement(Field, { label: Messages.metrics.label, invalid: !!errors.filter, error: (_b = errors.filter) === null || _b === void 0 ? void 0 : _b.message, description: Messages.metrics.description },
                            React.createElement(LabelsField, { control: methods.control }))),
                    React.createElement("button", { type: "submit", className: styles.none }))))));
};
export default AddEditRoleForm;
//# sourceMappingURL=AddEditRoleForm.js.map