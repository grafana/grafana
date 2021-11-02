import { __assign, __read, __rest } from "tslib";
import React, { useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Input, IconButton } from '@grafana/ui';
export var PasswordField = React.forwardRef(function (_a, ref) {
    var autoComplete = _a.autoComplete, autoFocus = _a.autoFocus, id = _a.id, passwordHint = _a.passwordHint, props = __rest(_a, ["autoComplete", "autoFocus", "id", "passwordHint"]);
    var _b = __read(useState(false), 2), showPassword = _b[0], setShowPassword = _b[1];
    return (React.createElement(Input, __assign({ id: id, autoFocus: autoFocus, autoComplete: autoComplete }, props, { type: showPassword ? 'text' : 'password', placeholder: passwordHint, "aria-label": selectors.pages.Login.password, ref: ref, suffix: React.createElement(IconButton, { name: showPassword ? 'eye-slash' : 'eye', type: "button", "aria-controls": id, role: "switch", "aria-checked": showPassword, "aria-label": "Show password", onClick: function () {
                setShowPassword(!showPassword);
            } }) })));
});
PasswordField.displayName = 'PasswordField';
//# sourceMappingURL=PasswordField.js.map