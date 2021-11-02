import { __makeTemplateObject, __read } from "tslib";
import React, { useCallback, useState } from 'react';
import { css } from '@emotion/css';
import { saveAs } from 'file-saver';
import { Button, Modal, stylesFactory, TextArea, useTheme } from '@grafana/ui';
import { CopyToClipboard } from 'app/core/components/CopyToClipboard/CopyToClipboard';
import { AppEvents } from '@grafana/data';
import appEvents from '../../../../../core/app_events';
export var SaveProvisionedDashboardForm = function (_a) {
    var dashboard = _a.dashboard, onCancel = _a.onCancel;
    var theme = useTheme();
    var _b = __read(useState(function () {
        var clone = dashboard.getSaveModelClone();
        delete clone.id;
        return JSON.stringify(clone, null, 2);
    }), 2), dashboardJSON = _b[0], setDashboardJson = _b[1];
    var saveToFile = useCallback(function () {
        var blob = new Blob([dashboardJSON], {
            type: 'application/json;charset=utf-8',
        });
        saveAs(blob, dashboard.title + '-' + new Date().getTime() + '.json');
    }, [dashboard.title, dashboardJSON]);
    var onCopyToClipboardSuccess = useCallback(function () {
        appEvents.emit(AppEvents.alertSuccess, ['Dashboard JSON copied to clipboard']);
    }, []);
    var styles = getStyles(theme);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", null,
            React.createElement("div", null,
                "This dashboard cannot be saved from the Grafana UI because it has been provisioned from another source. Copy the JSON or save it to a file below, then you can update your dashboard in the provisioning source.",
                React.createElement("br", null),
                React.createElement("i", null,
                    "See",
                    ' ',
                    React.createElement("a", { className: "external-link", href: "https://grafana.com/docs/grafana/latest/administration/provisioning/#dashboards", target: "_blank", rel: "noreferrer" }, "documentation"),
                    ' ',
                    "for more information about provisioning."),
                React.createElement("br", null),
                " ",
                React.createElement("br", null),
                React.createElement("strong", null, "File path: "),
                " ",
                dashboard.meta.provisionedExternalId),
            React.createElement(TextArea, { spellCheck: false, value: dashboardJSON, onChange: function (e) {
                    setDashboardJson(e.currentTarget.value);
                }, className: styles.json }),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { variant: "secondary", onClick: onCancel, fill: "outline" }, "Cancel"),
                React.createElement(CopyToClipboard, { text: function () { return dashboardJSON; }, elType: Button, onSuccess: onCopyToClipboardSuccess }, "Copy JSON to clipboard"),
                React.createElement(Button, { onClick: saveToFile }, "Save JSON to file")))));
};
var getStyles = stylesFactory(function (theme) {
    return {
        json: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      height: 400px;\n      width: 100%;\n      overflow: auto;\n      resize: none;\n      font-family: monospace;\n    "], ["\n      height: 400px;\n      width: 100%;\n      overflow: auto;\n      resize: none;\n      font-family: monospace;\n    "]))),
    };
});
var templateObject_1;
//# sourceMappingURL=SaveProvisionedDashboardForm.js.map