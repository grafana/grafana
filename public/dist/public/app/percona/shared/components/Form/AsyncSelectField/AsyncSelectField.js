import { __rest } from "tslib";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { AsyncSelect } from '@grafana/ui';
import { Label } from '../Label';
import { withSelectStyles } from '../withSelectStyles/withSelectStyles';
const AsyncSelectFieldWrapper = (_a) => {
    var { label, name, className } = _a, props = __rest(_a, ["label", "name", "className"]);
    return (React.createElement(React.Fragment, null,
        React.createElement(Label, { label: label, dataTestId: `${name}-select-label` }),
        React.createElement(AsyncSelect, Object.assign({ className: className }, props))));
};
export const AsyncSelectField = withSelectStyles(AsyncSelectFieldWrapper);
//# sourceMappingURL=AsyncSelectField.js.map