import { __assign } from "tslib";
import { Checkbox, Field } from '@grafana/ui';
import React from 'react';
import { useFormContext } from 'react-hook-form';
export var GrafanaCommonChannelSettings = function (_a) {
    var pathPrefix = _a.pathPrefix, className = _a.className;
    var register = useFormContext().register;
    return (React.createElement("div", { className: className },
        React.createElement(Field, null,
            React.createElement(Checkbox, __assign({}, register(pathPrefix + "disableResolveMessage"), { label: "Disable resolved message", description: "Disable the resolve message [OK] that is sent when alerting state returns to false" })))));
};
//# sourceMappingURL=GrafanaCommonChannelSettings.js.map