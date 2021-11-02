import { __assign } from "tslib";
import { Checkbox, Field } from '@grafana/ui';
import React from 'react';
import { useFormContext } from 'react-hook-form';
export var CloudCommonChannelSettings = function (_a) {
    var pathPrefix = _a.pathPrefix, className = _a.className, _b = _a.readOnly, readOnly = _b === void 0 ? false : _b;
    var register = useFormContext().register;
    return (React.createElement("div", { className: className },
        React.createElement(Field, { disabled: readOnly },
            React.createElement(Checkbox, __assign({}, register(pathPrefix + "sendResolved"), { label: "Send resolved", disabled: readOnly, description: "Whether or not to notify about resolved alerts." })))));
};
//# sourceMappingURL=CloudCommonChannelSettings.js.map