import { __assign } from "tslib";
import React from 'react';
import { Button, Field, FieldSet, Form, Icon, Input, Tooltip } from '@grafana/ui';
import config from 'app/core/config';
var disableLoginForm = config.disableLoginForm;
export var UserProfileEditForm = function (_a) {
    var user = _a.user, isSavingUser = _a.isSavingUser, updateProfile = _a.updateProfile;
    var onSubmitProfileUpdate = function (data) {
        updateProfile(data);
    };
    return (React.createElement(Form, { onSubmit: onSubmitProfileUpdate, validateOn: "onBlur" }, function (_a) {
        var _b, _c, _d;
        var register = _a.register, errors = _a.errors;
        return (React.createElement(FieldSet, { label: "Edit profile" },
            React.createElement(Field, { label: "Name", invalid: !!errors.name, error: "Name is required", disabled: disableLoginForm },
                React.createElement(Input, __assign({}, register('name', { required: true }), { id: "edit-user-profile-name", placeholder: "Name", defaultValue: (_b = user === null || user === void 0 ? void 0 : user.name) !== null && _b !== void 0 ? _b : '', suffix: React.createElement(InputSuffix, null) }))),
            React.createElement(Field, { label: "Email", invalid: !!errors.email, error: "Email is required", disabled: disableLoginForm },
                React.createElement(Input, __assign({}, register('email', { required: true }), { id: "edit-user-profile-email", placeholder: "Email", defaultValue: (_c = user === null || user === void 0 ? void 0 : user.email) !== null && _c !== void 0 ? _c : '', suffix: React.createElement(InputSuffix, null) }))),
            React.createElement(Field, { label: "Username", disabled: disableLoginForm },
                React.createElement(Input, __assign({}, register('login'), { id: "edit-user-profile-username", defaultValue: (_d = user === null || user === void 0 ? void 0 : user.login) !== null && _d !== void 0 ? _d : '', placeholder: "Username", suffix: React.createElement(InputSuffix, null) }))),
            React.createElement("div", { className: "gf-form-button-row" },
                React.createElement(Button, { variant: "primary", disabled: isSavingUser, "aria-label": "Edit user profile save button" }, "Save"))));
    }));
};
export default UserProfileEditForm;
var InputSuffix = function () {
    return disableLoginForm ? (React.createElement(Tooltip, { content: "Login details locked because they are managed in another system." },
        React.createElement(Icon, { name: "lock" }))) : null;
};
//# sourceMappingURL=UserProfileEditForm.js.map