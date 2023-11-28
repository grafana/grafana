import React from 'react';
import { Checkbox, CollapsableSection, Field, InfoBox, Input } from '@grafana/ui';
export const NotificationSettings = ({ currentFormValues, imageRendererAvailable, register }) => {
    return (React.createElement(CollapsableSection, { label: "Notification settings", isOpen: false },
        React.createElement(Field, null,
            React.createElement(Checkbox, Object.assign({}, register('isDefault'), { label: "Default", description: "Use this notification for all alerts" }))),
        React.createElement(Field, null,
            React.createElement(Checkbox, Object.assign({}, register('settings.uploadImage'), { label: "Include image", description: "Captures an image and include it in the notification" }))),
        currentFormValues.uploadImage && !imageRendererAvailable && (React.createElement(InfoBox, { title: "No image renderer available/installed" }, "Grafana cannot find an image renderer to capture an image for the notification. Please make sure the Grafana Image Renderer plugin is installed. Please contact your Grafana administrator to install the plugin.")),
        React.createElement(Field, null,
            React.createElement(Checkbox, Object.assign({}, register('disableResolveMessage'), { label: "Disable Resolve Message", description: "Disable the resolve message [OK] that is sent when alerting state returns to false" }))),
        React.createElement(Field, null,
            React.createElement(Checkbox, Object.assign({}, register('sendReminder'), { label: "Send reminders", description: "Send additional notifications for triggered alerts" }))),
        currentFormValues.sendReminder && (React.createElement(React.Fragment, null,
            React.createElement(Field, { label: "Send reminder every", description: "Specify how often reminders should be sent, e.g. every 30s, 1m, 10m, 30m', or 1h etc.\n            Alert reminders are sent after rules are evaluated. A reminder can never be sent more frequently\n            than a configured alert rule evaluation interval." },
                React.createElement(Input, Object.assign({}, register('frequency'), { width: 8 })))))));
};
//# sourceMappingURL=NotificationSettings.js.map