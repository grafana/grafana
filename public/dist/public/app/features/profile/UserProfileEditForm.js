import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Button, Field, FieldSet, Form, Icon, Input, Tooltip } from '@grafana/ui';
import config from 'app/core/config';
import { t, Trans } from 'app/core/internationalization';
const { disableLoginForm } = config;
export const UserProfileEditForm = ({ user, isSavingUser, updateProfile }) => {
    var _a;
    const onSubmitProfileUpdate = (data) => {
        updateProfile(data);
    };
    // check if authLabels is longer than 0 otherwise false
    const isExternalUser = (_a = (user && user.isExternal)) !== null && _a !== void 0 ? _a : false;
    const authSource = isExternalUser && user && user.authLabels ? user.authLabels[0] : '';
    const lockMessage = authSource ? ` (Synced via ${authSource})` : '';
    const disabledEdit = disableLoginForm || isExternalUser;
    return (React.createElement(Form, { onSubmit: onSubmitProfileUpdate, validateOn: "onBlur" }, ({ register, errors }) => {
        var _a, _b, _c;
        return (React.createElement(React.Fragment, null,
            React.createElement(FieldSet, null,
                React.createElement(Field, { label: t('user-profile.fields.name-label', 'Name') + lockMessage, invalid: !!errors.name, error: React.createElement(Trans, { i18nKey: "user-profile.fields.name-error" }, "Name is required"), disabled: disabledEdit },
                    React.createElement(Input, Object.assign({}, register('name', { required: true }), { id: "edit-user-profile-name", placeholder: t('user-profile.fields.name-label', 'Name'), defaultValue: (_a = user === null || user === void 0 ? void 0 : user.name) !== null && _a !== void 0 ? _a : '', suffix: React.createElement(InputSuffix, null) }))),
                React.createElement(Field, { label: t('user-profile.fields.email-label', 'Email') + lockMessage, invalid: !!errors.email, error: React.createElement(Trans, { i18nKey: "user-profile.fields.email-error" }, "Email is required"), disabled: disabledEdit },
                    React.createElement(Input, Object.assign({}, register('email', { required: true }), { id: "edit-user-profile-email", placeholder: t('user-profile.fields.email-label', 'Email'), defaultValue: (_b = user === null || user === void 0 ? void 0 : user.email) !== null && _b !== void 0 ? _b : '', suffix: React.createElement(InputSuffix, null) }))),
                React.createElement(Field, { label: t('user-profile.fields.username-label', 'Username') + lockMessage, disabled: disabledEdit },
                    React.createElement(Input, Object.assign({}, register('login'), { id: "edit-user-profile-username", defaultValue: (_c = user === null || user === void 0 ? void 0 : user.login) !== null && _c !== void 0 ? _c : '', placeholder: t('user-profile.fields.username-label', 'Username') + lockMessage, suffix: React.createElement(InputSuffix, null) })))),
            React.createElement(Button, { variant: "primary", disabled: isSavingUser || disabledEdit, "data-testid": selectors.components.UserProfile.profileSaveButton, type: "submit" },
                React.createElement(Trans, { i18nKey: "common.save" }, "Save"))));
    }));
};
export default UserProfileEditForm;
const InputSuffix = () => {
    return disableLoginForm ? (React.createElement(Tooltip, { content: "Login details locked because they are managed in another system." },
        React.createElement(Icon, { name: "lock" }))) : null;
};
//# sourceMappingURL=UserProfileEditForm.js.map