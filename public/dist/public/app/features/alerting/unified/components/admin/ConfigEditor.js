import React from 'react';
import { Button, CodeEditor, ConfirmModal, Field, Form, HorizontalGroup } from '@grafana/ui';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
export const ConfigEditor = ({ defaultValues, readOnly, loading, alertManagerSourceName, showConfirmDeleteAMConfig, onSubmit, onReset, onConfirmReset, onDismiss, }) => {
    return (React.createElement(Form, { defaultValues: defaultValues, onSubmit: onSubmit, key: defaultValues.configJSON }, ({ errors, setValue, register }) => {
        var _a;
        register('configJSON', {
            required: { value: true, message: 'Required' },
            validate: (value) => {
                try {
                    JSON.parse(value);
                    return true;
                }
                catch (e) {
                    return e instanceof Error ? e.message : 'JSON is invalid';
                }
            },
        });
        return (React.createElement(React.Fragment, null,
            React.createElement(Field, { disabled: loading, label: "Configuration", invalid: !!errors.configJSON, error: (_a = errors.configJSON) === null || _a === void 0 ? void 0 : _a.message, "data-testid": readOnly ? 'readonly-config' : 'config' },
                React.createElement(CodeEditor, { language: "json", width: "100%", height: 500, showLineNumbers: true, value: defaultValues.configJSON, showMiniMap: false, onSave: (value) => {
                        setValue('configJSON', value);
                    }, onBlur: (value) => {
                        setValue('configJSON', value);
                    }, readOnly: readOnly })),
            !readOnly && (React.createElement(HorizontalGroup, null,
                React.createElement(Button, { type: "submit", variant: "primary", disabled: loading }, "Save configuration"),
                onReset && (React.createElement(Button, { type: "button", disabled: loading, variant: "destructive", onClick: onReset }, "Reset configuration")))),
            Boolean(showConfirmDeleteAMConfig) && onConfirmReset && onDismiss && (React.createElement(ConfirmModal, { isOpen: true, title: "Reset Alertmanager configuration", body: `Are you sure you want to reset configuration ${alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME
                    ? 'for the Grafana Alertmanager'
                    : `for "${alertManagerSourceName}"`}? Contact points and notification policies will be reset to their defaults.`, confirmText: "Yes, reset configuration", onConfirm: onConfirmReset, onDismiss: onDismiss }))));
    }));
};
//# sourceMappingURL=ConfigEditor.js.map