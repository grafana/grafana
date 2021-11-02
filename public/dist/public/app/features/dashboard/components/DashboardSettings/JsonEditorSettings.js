import { __makeTemplateObject, __read } from "tslib";
import React, { useState } from 'react';
import { css } from '@emotion/css';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Button, CodeEditor, HorizontalGroup, useStyles2 } from '@grafana/ui';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { getDashboardSrv } from '../../services/DashboardSrv';
export var JsonEditorSettings = function (_a) {
    var dashboard = _a.dashboard;
    var _b = __read(useState(JSON.stringify(dashboard.getSaveModelClone(), null, 2)), 2), dashboardJson = _b[0], setDashboardJson = _b[1];
    var onBlur = function (value) {
        setDashboardJson(value);
    };
    var onClick = function () {
        getDashboardSrv()
            .saveJSONDashboard(dashboardJson)
            .then(function () {
            dashboardWatcher.reloadPage();
        });
    };
    var styles = useStyles2(getStyles);
    return (React.createElement("div", null,
        React.createElement("h3", { className: "dashboard-settings__header" }, "JSON Model"),
        React.createElement("div", { className: "dashboard-settings__subheader" }, "The JSON model below is the data structure that defines the dashboard. This includes dashboard settings, panel settings, layout, queries, and so on."),
        React.createElement("div", { className: styles.editWrapper },
            React.createElement(AutoSizer, null, function (_a) {
                var width = _a.width, height = _a.height;
                return (React.createElement(CodeEditor, { value: dashboardJson, language: "json", width: width, height: height, showMiniMap: true, showLineNumbers: true, onBlur: onBlur }));
            })),
        dashboard.meta.canSave && (React.createElement(HorizontalGroup, null,
            React.createElement(Button, { onClick: onClick }, "Save changes")))));
};
var getStyles = function (theme) { return ({
    editWrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    height: calc(100vh - 250px);\n    margin-bottom: 10px;\n  "], ["\n    height: calc(100vh - 250px);\n    margin-bottom: 10px;\n  "]))),
}); };
var templateObject_1;
//# sourceMappingURL=JsonEditorSettings.js.map