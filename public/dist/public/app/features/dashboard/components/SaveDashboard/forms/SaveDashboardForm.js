import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Stack } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Button, Checkbox, Form, TextArea, useStyles2 } from '@grafana/ui';
import { GenAIDashboardChangesButton } from '../../GenAI/GenAIDashboardChangesButton';
export const SaveDashboardForm = ({ dashboard, isLoading, saveModel, options, onSubmit, onCancel, onSuccess, onOptionsChange, }) => {
    const hasTimeChanged = useMemo(() => dashboard.hasTimeChanged(), [dashboard]);
    const hasVariableChanged = useMemo(() => dashboard.hasVariablesChanged(), [dashboard]);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(options.message);
    const styles = useStyles2(getStyles);
    return (React.createElement(Form, { onSubmit: (data) => __awaiter(void 0, void 0, void 0, function* () {
            if (!onSubmit) {
                return;
            }
            setSaving(true);
            options = Object.assign(Object.assign({}, options), { message });
            const result = yield onSubmit(saveModel.clone, options, dashboard);
            if (result.status === 'success') {
                onSuccess();
            }
            else {
                setSaving(false);
            }
        }) }, ({ register, errors }) => {
        return (React.createElement(Stack, { gap: 2, direction: "column", alignItems: "flex-start" },
            hasTimeChanged && (React.createElement(Checkbox, { checked: !!options.saveTimerange, onChange: () => onOptionsChange(Object.assign(Object.assign({}, options), { saveTimerange: !options.saveTimerange })), label: "Save current time range as dashboard default", "aria-label": selectors.pages.SaveDashboardModal.saveTimerange })),
            hasVariableChanged && (React.createElement(Checkbox, { checked: !!options.saveVariables, onChange: () => onOptionsChange(Object.assign(Object.assign({}, options), { saveVariables: !options.saveVariables })), label: "Save current variable values as dashboard default", "aria-label": selectors.pages.SaveDashboardModal.saveVariables })),
            React.createElement("div", { className: styles.message },
                config.featureToggles.dashgpt && (React.createElement(GenAIDashboardChangesButton, { dashboard: dashboard, onGenerate: (text) => {
                        onOptionsChange(Object.assign(Object.assign({}, options), { message: text }));
                        setMessage(text);
                    }, disabled: !saveModel.hasChanges })),
                React.createElement(TextArea, { "aria-label": "message", value: message, onChange: (e) => {
                        onOptionsChange(Object.assign(Object.assign({}, options), { message: e.currentTarget.value }));
                        setMessage(e.currentTarget.value);
                    }, placeholder: "Add a note to describe your changes.", autoFocus: true, rows: 5 })),
            React.createElement(Stack, { alignItems: "center" },
                React.createElement(Button, { variant: "secondary", onClick: onCancel, fill: "outline" }, "Cancel"),
                React.createElement(Button, { type: "submit", disabled: !saveModel.hasChanges || isLoading, icon: saving ? 'fa fa-spinner' : undefined, "aria-label": selectors.pages.SaveDashboardModal.save }, isLoading ? 'Saving...' : 'Save'),
                !saveModel.hasChanges && React.createElement("div", null, "No changes to save"))));
    }));
};
function getStyles(theme) {
    return {
        message: css `
      display: flex;
      align-items: end;
      flex-direction: column;
      width: 100%;
    `,
    };
}
//# sourceMappingURL=SaveDashboardForm.js.map