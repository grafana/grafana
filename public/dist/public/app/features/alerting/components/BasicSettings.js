import { __assign, __rest } from "tslib";
import React from 'react';
import { Field, Input, InputControl, Select } from '@grafana/ui';
import { NotificationChannelOptions } from './NotificationChannelOptions';
export var BasicSettings = function (_a) {
    var control = _a.control, currentFormValues = _a.currentFormValues, errors = _a.errors, secureFields = _a.secureFields, selectedChannel = _a.selectedChannel, channels = _a.channels, register = _a.register, resetSecureField = _a.resetSecureField;
    return (React.createElement(React.Fragment, null,
        React.createElement(Field, { label: "Name", invalid: !!errors.name, error: errors.name && errors.name.message },
            React.createElement(Input, __assign({}, register('name', { required: 'Name is required' })))),
        React.createElement(Field, { label: "Type" },
            React.createElement(InputControl, { name: "type", render: function (_a) {
                    var _b = _a.field, ref = _b.ref, field = __rest(_b, ["ref"]);
                    return React.createElement(Select, __assign({ menuShouldPortal: true }, field, { options: channels }));
                }, control: control, rules: { required: true } })),
        React.createElement(NotificationChannelOptions, { selectedChannelOptions: selectedChannel.options.filter(function (o) { return o.required; }), currentFormValues: currentFormValues, secureFields: secureFields, onResetSecureField: resetSecureField, register: register, errors: errors, control: control })));
};
//# sourceMappingURL=BasicSettings.js.map