import React from 'react';
import { Alert, CollapsableSection } from '@grafana/ui';
import { NotificationChannelOptions } from './NotificationChannelOptions';
export const ChannelSettings = ({ control, currentFormValues, errors, selectedChannel, secureFields, register, resetSecureField, }) => {
    var _a;
    return (React.createElement(CollapsableSection, { label: `Optional ${selectedChannel.heading}`, isOpen: false },
        selectedChannel.info !== '' && React.createElement(Alert, { severity: "info", title: (_a = selectedChannel.info) !== null && _a !== void 0 ? _a : '' }),
        React.createElement(NotificationChannelOptions, { selectedChannelOptions: selectedChannel.options.filter((o) => !o.required), currentFormValues: currentFormValues, register: register, errors: errors, control: control, onResetSecureField: resetSecureField, secureFields: secureFields })));
};
//# sourceMappingURL=ChannelSettings.js.map