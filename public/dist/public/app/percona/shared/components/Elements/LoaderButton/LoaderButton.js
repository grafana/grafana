import { __rest } from "tslib";
import React from 'react';
import { Button, Spinner } from '@grafana/ui';
export const LoaderButton = (_a) => {
    var { children, className, disabled, loading = false, size = 'md' } = _a, props = __rest(_a, ["children", "className", "disabled", "loading", "size"]);
    return (React.createElement(Button, Object.assign({ className: className, size: size, disabled: loading || disabled }, props), loading ? React.createElement(Spinner, null) : children));
};
//# sourceMappingURL=LoaderButton.js.map