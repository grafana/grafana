import { __rest } from "tslib";
import React from 'react';
import { Field, Input, InputControl, Select } from '@grafana/ui';
import { NotificationChannelOptions } from './NotificationChannelOptions';
export const BasicSettings = ({ control, currentFormValues, errors, secureFields, selectedChannel, channels, register, resetSecureField, }) => {
    return (React.createElement(React.Fragment, null,
        React.createElement(Field, { label: "Name", invalid: !!errors.name, error: errors.name && errors.name.message },
            React.createElement(Input, Object.assign({}, register('name', { required: 'Name is required' })))),
        React.createElement(Field, { label: "Type" },
            React.createElement(InputControl, { name: "type", render: (_a) => {
                    var _b = _a.field, { ref } = _b, field = __rest(_b, ["ref"]);
                    return React.createElement(Select, Object.assign({}, field, { options: channels }));
                }, control: control, rules: { required: true } })),
        React.createElement(NotificationChannelOptions, { selectedChannelOptions: selectedChannel.options.filter((o) => o.required), currentFormValues: currentFormValues, secureFields: secureFields, onResetSecureField: resetSecureField, register: register, errors: errors, control: control })));
};
//# sourceMappingURL=BasicSettings.js.map