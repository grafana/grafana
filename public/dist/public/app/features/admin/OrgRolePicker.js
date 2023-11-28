import { __rest } from "tslib";
import React from 'react';
import { OrgRole } from '@grafana/data';
import { Select } from '@grafana/ui';
const options = Object.keys(OrgRole).map((key) => ({ label: key, value: key }));
export function OrgRolePicker(_a) {
    var { value, onChange, 'aria-label': ariaLabel, inputId, autoFocus } = _a, restProps = __rest(_a, ["value", "onChange", 'aria-label', "inputId", "autoFocus"]);
    return (React.createElement(Select, Object.assign({ inputId: inputId, value: value, options: options, onChange: (val) => onChange(val.value), placeholder: "Choose role...", "aria-label": ariaLabel, autoFocus: autoFocus }, restProps)));
}
//# sourceMappingURL=OrgRolePicker.js.map