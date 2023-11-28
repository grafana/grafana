import { __rest } from "tslib";
import React, { useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Input, IconButton } from '@grafana/ui';
export const PasswordField = React.forwardRef((_a, ref) => {
    var { autoComplete, autoFocus, id, passwordHint } = _a, props = __rest(_a, ["autoComplete", "autoFocus", "id", "passwordHint"]);
    const [showPassword, setShowPassword] = useState(false);
    return (React.createElement(Input, Object.assign({ id: id, autoFocus: autoFocus, autoComplete: autoComplete }, props, { type: showPassword ? 'text' : 'password', placeholder: passwordHint, "aria-label": selectors.pages.Login.password, ref: ref, suffix: React.createElement(IconButton, { name: showPassword ? 'eye-slash' : 'eye', "aria-controls": id, role: "switch", "aria-checked": showPassword, onClick: () => {
                setShowPassword(!showPassword);
            }, tooltip: showPassword ? 'Hide password' : 'Show password' }) })));
});
PasswordField.displayName = 'PasswordField';
//# sourceMappingURL=PasswordField.js.map