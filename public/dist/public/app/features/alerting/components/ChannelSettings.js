import React from 'react';
import { Alert, CollapsableSection } from '@grafana/ui';
import { NotificationChannelOptions } from './NotificationChannelOptions';
export var ChannelSettings = function (_a) {
    var _b;
    var control = _a.control, currentFormValues = _a.currentFormValues, errors = _a.errors, selectedChannel = _a.selectedChannel, secureFields = _a.secureFields, register = _a.register, resetSecureField = _a.resetSecureField;
    return (React.createElement(CollapsableSection, { label: "Optional " + selectedChannel.heading, isOpen: false },
        selectedChannel.info !== '' && React.createElement(Alert, { severity: "info", title: (_b = selectedChannel.info) !== null && _b !== void 0 ? _b : '' }),
        React.createElement(NotificationChannelOptions, { selectedChannelOptions: selectedChannel.options.filter(function (o) { return !o.required; }), currentFormValues: currentFormValues, register: register, errors: errors, control: control, onResetSecureField: resetSecureField, secureFields: secureFields })));
};
//# sourceMappingURL=ChannelSettings.js.map