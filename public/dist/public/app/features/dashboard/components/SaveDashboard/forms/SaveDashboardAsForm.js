import { __awaiter, __rest } from "tslib";
import React from 'react';
import { config } from '@grafana/runtime';
import { Button, Input, Switch, Form, Field, InputControl, HorizontalGroup, Label, TextArea } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { GenAIDashDescriptionButton } from '../../GenAI/GenAIDashDescriptionButton';
import { GenAIDashTitleButton } from '../../GenAI/GenAIDashTitleButton';
const getSaveAsDashboardClone = (dashboard) => {
    const clone = dashboard.getSaveModelClone();
    clone.id = null;
    clone.uid = '';
    clone.title += ' Copy';
    clone.editable = true;
    // remove alerts if source dashboard is already persisted
    // do not want to create alert dupes
    if (dashboard.id > 0 && clone.panels) {
        clone.panels.forEach((panel) => {
            // @ts-expect-error
            if (panel.type === 'graph' && panel.alert) {
                // @ts-expect-error
                delete panel.thresholds;
            }
            // @ts-expect-error
            delete panel.alert;
        });
    }
    return clone;
};
export const SaveDashboardAsForm = ({ dashboard, isLoading, isNew, onSubmit, onCancel, onSuccess, }) => {
    const defaultValues = {
        title: isNew ? dashboard.title : `${dashboard.title} Copy`,
        description: dashboard.description,
        $folder: {
            uid: dashboard.meta.folderUid,
            title: dashboard.meta.folderTitle,
        },
        copyTags: false,
    };
    const validateDashboardName = (getFormValues) => (dashboardName) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        if (dashboardName && dashboardName === ((_a = getFormValues().$folder.title) === null || _a === void 0 ? void 0 : _a.trim())) {
            return 'Dashboard name cannot be the same as folder name';
        }
        try {
            yield validationSrv.validateNewDashboardName((_b = getFormValues().$folder.uid) !== null && _b !== void 0 ? _b : 'general', dashboardName);
            return true;
        }
        catch (e) {
            return e instanceof Error ? e.message : 'Dashboard name is invalid';
        }
    });
    return (React.createElement(Form, { defaultValues: defaultValues, onSubmit: (data) => __awaiter(void 0, void 0, void 0, function* () {
            if (!onSubmit) {
                return;
            }
            const clone = getSaveAsDashboardClone(dashboard);
            clone.title = data.title;
            clone.description = data.description;
            if (!isNew && !data.copyTags) {
                clone.tags = [];
            }
            const result = yield onSubmit(clone, {
                folderUid: data.$folder.uid,
            }, dashboard);
            if (result.status === 'success') {
                onSuccess();
            }
        }) }, ({ register, control, errors, getValues }) => (React.createElement(React.Fragment, null,
        React.createElement(InputControl, { render: (_a) => {
                var _b;
                var _c = _a.field, { ref } = _c, field = __rest(_c, ["ref"]);
                return (React.createElement(Field, { label: React.createElement(HorizontalGroup, { justify: "space-between" },
                        React.createElement(Label, { htmlFor: "title" }, "Title"),
                        config.featureToggles.dashgpt && isNew && (React.createElement(GenAIDashTitleButton, { onGenerate: (title) => field.onChange(title), dashboard: dashboard }))), invalid: !!errors.title, error: (_b = errors.title) === null || _b === void 0 ? void 0 : _b.message },
                    React.createElement(Input, Object.assign({}, field, { onChange: (e) => field.onChange(e.target.value), "aria-label": "Save dashboard title field", autoFocus: true }))));
            }, control: control, name: "title", rules: {
                validate: validateDashboardName(getValues),
            } }),
        React.createElement(InputControl, { render: (_a) => {
                var _b;
                var _c = _a.field, { ref } = _c, field = __rest(_c, ["ref"]);
                return (React.createElement(Field, { label: React.createElement(HorizontalGroup, { justify: "space-between" },
                        React.createElement(Label, { htmlFor: "description" }, "Description"),
                        config.featureToggles.dashgpt && isNew && (React.createElement(GenAIDashDescriptionButton, { onGenerate: (description) => field.onChange(description), dashboard: dashboard }))), invalid: !!errors.description, error: (_b = errors.description) === null || _b === void 0 ? void 0 : _b.message },
                    React.createElement(TextArea, Object.assign({}, field, { onChange: (e) => field.onChange(e.target.value), "aria-label": "Save dashboard description field", autoFocus: true }))));
            }, control: control, name: "description" }),
        React.createElement(Field, { label: "Folder" },
            React.createElement(InputControl, { render: (_a) => {
                    var _b;
                    var _c = _a.field, { ref } = _c, field = __rest(_c, ["ref"]);
                    return (React.createElement(FolderPicker, Object.assign({}, field, { onChange: (uid, title) => field.onChange({ uid, title }), value: (_b = field.value) === null || _b === void 0 ? void 0 : _b.uid, 
                        // Old folder picker fields
                        initialTitle: dashboard.meta.folderTitle, dashboardId: dashboard.id, enableCreateNew: true })));
                }, control: control, name: "$folder" })),
        !isNew && (React.createElement(Field, { label: "Copy tags" },
            React.createElement(Switch, Object.assign({}, register('copyTags'))))),
        React.createElement(HorizontalGroup, null,
            React.createElement(Button, { type: "button", variant: "secondary", onClick: onCancel, fill: "outline" }, "Cancel"),
            React.createElement(Button, { disabled: isLoading, type: "submit", "aria-label": "Save dashboard button" }, isLoading ? 'Saving...' : 'Save'))))));
};
//# sourceMappingURL=SaveDashboardAsForm.js.map