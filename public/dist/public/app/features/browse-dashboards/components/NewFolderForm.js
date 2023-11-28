import { __awaiter } from "tslib";
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Button, Input, Form, Field, HorizontalGroup } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { validationSrv } from '../../manage-dashboards/services/ValidationSrv';
const initialFormModel = { folderName: '' };
export function NewFolderForm({ onCancel, onConfirm }) {
    const translatedFolderNameRequiredPhrase = t('browse-dashboards.action.new-folder-name-required-phrase', 'Folder name is required.');
    const validateFolderName = (folderName) => __awaiter(this, void 0, void 0, function* () {
        try {
            yield validationSrv.validateNewFolderName(folderName);
            return true;
        }
        catch (e) {
            if (e instanceof Error) {
                return e.message;
            }
            else {
                throw e;
            }
        }
    });
    const fieldNameLabel = t('browse-dashboards.new-folder-form.name-label', 'Folder name');
    return (React.createElement(Form, { defaultValues: initialFormModel, onSubmit: (form) => onConfirm(form.folderName), "data-testid": selectors.pages.BrowseDashboards.NewFolderForm.form }, ({ register, errors }) => (React.createElement(React.Fragment, null,
        React.createElement(Field, { label: fieldNameLabel, invalid: !!errors.folderName, error: errors.folderName && errors.folderName.message },
            React.createElement(Input, Object.assign({ "data-testid": selectors.pages.BrowseDashboards.NewFolderForm.nameInput, id: "folder-name-input" }, register('folderName', {
                required: translatedFolderNameRequiredPhrase,
                validate: (v) => __awaiter(this, void 0, void 0, function* () { return yield validateFolderName(v); }),
            })))),
        React.createElement(HorizontalGroup, null,
            React.createElement(Button, { variant: "secondary", fill: "outline", onClick: onCancel },
                React.createElement(Trans, { i18nKey: "browse-dashboards.new-folder-form.cancel-label" }, "Cancel")),
            React.createElement(Button, { type: "submit" },
                React.createElement(Trans, { i18nKey: "browse-dashboards.new-folder-form.create-label" }, "Create")))))));
}
//# sourceMappingURL=NewFolderForm.js.map