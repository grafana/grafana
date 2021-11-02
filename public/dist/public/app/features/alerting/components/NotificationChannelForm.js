import { __makeTemplateObject, __read, __spreadArray } from "tslib";
import React, { useEffect } from 'react';
import { css } from '@emotion/css';
import { Button, HorizontalGroup, stylesFactory, useTheme, Spinner } from '@grafana/ui';
import { NotificationSettings } from './NotificationSettings';
import { BasicSettings } from './BasicSettings';
import { ChannelSettings } from './ChannelSettings';
import config from 'app/core/config';
export var NotificationChannelForm = function (_a) {
    var control = _a.control, errors = _a.errors, selectedChannel = _a.selectedChannel, selectableChannels = _a.selectableChannels, register = _a.register, watch = _a.watch, getValues = _a.getValues, imageRendererAvailable = _a.imageRendererAvailable, onTestChannel = _a.onTestChannel, resetSecureField = _a.resetSecureField, secureFields = _a.secureFields;
    var styles = getStyles(useTheme());
    useEffect(function () {
        /*
          Finds fields that have dependencies on other fields and removes duplicates.
          Needs to be prefixed with settings.
        */
        var fieldsToWatch = new Set(selectedChannel === null || selectedChannel === void 0 ? void 0 : selectedChannel.options.filter(function (o) { return o.showWhen.field; }).map(function (option) {
            return "settings." + option.showWhen.field;
        })) || [];
        watch(__spreadArray(['type', 'sendReminder', 'uploadImage'], __read(fieldsToWatch), false));
    }, [selectedChannel === null || selectedChannel === void 0 ? void 0 : selectedChannel.options, watch]);
    var currentFormValues = getValues();
    if (!selectedChannel) {
        return React.createElement(Spinner, null);
    }
    return (React.createElement("div", { className: styles.formContainer },
        React.createElement("div", { className: styles.formItem },
            React.createElement(BasicSettings, { selectedChannel: selectedChannel, channels: selectableChannels, secureFields: secureFields, resetSecureField: resetSecureField, currentFormValues: currentFormValues, register: register, errors: errors, control: control })),
        selectedChannel.options.filter(function (o) { return !o.required; }).length > 0 && (React.createElement("div", { className: styles.formItem },
            React.createElement(ChannelSettings, { selectedChannel: selectedChannel, secureFields: secureFields, resetSecureField: resetSecureField, currentFormValues: currentFormValues, register: register, errors: errors, control: control }))),
        React.createElement("div", { className: styles.formItem },
            React.createElement(NotificationSettings, { imageRendererAvailable: imageRendererAvailable, currentFormValues: currentFormValues, register: register, errors: errors, control: control })),
        React.createElement("div", { className: styles.formButtons },
            React.createElement(HorizontalGroup, null,
                React.createElement(Button, { type: "submit" }, "Save"),
                React.createElement(Button, { type: "button", variant: "secondary", onClick: function () { return onTestChannel(getValues()); } }, "Test"),
                React.createElement("a", { href: config.appSubUrl + "/alerting/notifications" },
                    React.createElement(Button, { type: "button", variant: "secondary" }, "Back"))))));
};
var getStyles = stylesFactory(function (theme) {
    return {
        formContainer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject([""], [""]))),
        formItem: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      flex-grow: 1;\n      padding-top: ", ";\n    "], ["\n      flex-grow: 1;\n      padding-top: ", ";\n    "])), theme.spacing.md),
        formButtons: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      padding-top: ", ";\n    "], ["\n      padding-top: ", ";\n    "])), theme.spacing.xl),
    };
});
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=NotificationChannelForm.js.map