import { __assign, __rest } from "tslib";
import React from 'react';
import { OrgRole } from '@grafana/data';
import { Select } from '@grafana/ui';
var options = Object.keys(OrgRole).map(function (key) { return ({ label: key, value: key }); });
export var OrgRolePicker = function (_a) {
    var value = _a.value, onChange = _a.onChange, ariaLabel = _a["aria-label"], restProps = __rest(_a, ["value", "onChange", 'aria-label']);
    return (React.createElement(Select, __assign({ menuShouldPortal: true, value: value, options: options, onChange: function (val) { return onChange(val.value); }, placeholder: "Choose role...", "aria-label": ariaLabel }, restProps)));
};
//# sourceMappingURL=OrgRolePicker.js.map