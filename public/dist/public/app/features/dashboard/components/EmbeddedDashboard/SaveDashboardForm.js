import { __awaiter } from "tslib";
import React, { useMemo, useState } from 'react';
import { Stack } from '@grafana/experimental';
import { Button, Form } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
export const SaveDashboardForm = ({ dashboard, onCancel, onSubmit, onSuccess, saveModel }) => {
    const [saving, setSaving] = useState(false);
    const notifyApp = useAppNotification();
    const hasChanges = useMemo(() => dashboard.hasTimeChanged() || saveModel.hasChanges, [dashboard, saveModel]);
    const onFormSubmit = () => __awaiter(void 0, void 0, void 0, function* () {
        if (!onSubmit) {
            return;
        }
        setSaving(true);
        onSubmit(saveModel.clone)
            .then(() => {
            notifyApp.success('Dashboard saved locally');
            onSuccess();
        })
            .catch((error) => {
            notifyApp.error(error.message || 'Error saving dashboard');
        })
            .finally(() => setSaving(false));
    });
    return (React.createElement(Form, { onSubmit: onFormSubmit }, () => {
        return (React.createElement(Stack, { gap: 2 },
            React.createElement(Stack, { alignItems: "center" },
                React.createElement(Button, { variant: "secondary", onClick: onCancel, fill: "outline" }, "Cancel"),
                React.createElement(Button, { type: "submit", disabled: !hasChanges, icon: saving ? 'fa fa-spinner' : undefined }, "Save"),
                !hasChanges && React.createElement("div", null, "No changes to save"))));
    }));
};
//# sourceMappingURL=SaveDashboardForm.js.map