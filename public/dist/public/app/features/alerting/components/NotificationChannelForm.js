import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { Button, HorizontalGroup, Spinner, useStyles2 } from '@grafana/ui';
import config from 'app/core/config';
import { BasicSettings } from './BasicSettings';
import { ChannelSettings } from './ChannelSettings';
import { NotificationSettings } from './NotificationSettings';
export const NotificationChannelForm = ({ control, errors, selectedChannel, selectableChannels, register, watch, getValues, imageRendererAvailable, onTestChannel, resetSecureField, secureFields, }) => {
    const styles = useStyles2(getStyles);
    useEffect(() => {
        /*
          Find fields that have dependencies on other fields and removes duplicates.
          Needs to be prefixed with settings.
        */
        const fieldsToWatch = new Set(selectedChannel === null || selectedChannel === void 0 ? void 0 : selectedChannel.options.filter((o) => o.showWhen.field).map((option) => {
            return `settings.${option.showWhen.field}`;
        })) || [];
        watch(['type', 'sendReminder', 'uploadImage', ...fieldsToWatch]);
    }, [selectedChannel === null || selectedChannel === void 0 ? void 0 : selectedChannel.options, watch]);
    const currentFormValues = getValues();
    if (!selectedChannel) {
        return React.createElement(Spinner, null);
    }
    return (React.createElement("div", { className: styles.formContainer },
        React.createElement("div", { className: styles.formItem },
            React.createElement(BasicSettings, { selectedChannel: selectedChannel, channels: selectableChannels, secureFields: secureFields, resetSecureField: resetSecureField, currentFormValues: currentFormValues, register: register, errors: errors, control: control })),
        selectedChannel.options.filter((o) => !o.required).length > 0 && (React.createElement("div", { className: styles.formItem },
            React.createElement(ChannelSettings, { selectedChannel: selectedChannel, secureFields: secureFields, resetSecureField: resetSecureField, currentFormValues: currentFormValues, register: register, errors: errors, control: control }))),
        React.createElement("div", { className: styles.formItem },
            React.createElement(NotificationSettings, { imageRendererAvailable: imageRendererAvailable, currentFormValues: currentFormValues, register: register, errors: errors, control: control })),
        React.createElement("div", { className: styles.formButtons },
            React.createElement(HorizontalGroup, null,
                React.createElement(Button, { type: "submit" }, "Save"),
                React.createElement(Button, { type: "button", variant: "secondary", onClick: () => onTestChannel(getValues()) }, "Test"),
                React.createElement("a", { href: `${config.appSubUrl}/alerting/notifications` },
                    React.createElement(Button, { type: "button", variant: "secondary" }, "Back"))))));
};
const getStyles = (theme) => {
    return {
        formContainer: css ``,
        formItem: css `
      flex-grow: 1;
      padding-top: ${theme.spacing(2)};
    `,
        formButtons: css `
      padding-top: ${theme.spacing(4)};
    `,
    };
};
//# sourceMappingURL=NotificationChannelForm.js.map