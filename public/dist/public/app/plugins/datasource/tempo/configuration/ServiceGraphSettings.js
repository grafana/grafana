import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, InlineField, InlineFieldRow, useStyles } from '@grafana/ui';
import React from 'react';
export function ServiceGraphSettings(_a) {
    var _b;
    var options = _a.options, onOptionsChange = _a.onOptionsChange;
    var styles = useStyles(getStyles);
    return (React.createElement("div", { className: css({ width: '100%' }) },
        React.createElement("h3", { className: "page-heading" }, "Service Graph"),
        React.createElement("div", { className: styles.infoText }, "To allow querying service graph data you have to select a Prometheus instance where the data is stored."),
        React.createElement(InlineFieldRow, { className: styles.row },
            React.createElement(InlineField, { tooltip: "The Prometheus data source with the service graph data", label: "Data source", labelWidth: 26 },
                React.createElement(DataSourcePicker, { pluginId: "prometheus", current: (_b = options.jsonData.serviceMap) === null || _b === void 0 ? void 0 : _b.datasourceUid, noDefault: true, width: 40, onChange: function (ds) {
                        return updateDatasourcePluginJsonDataOption({ onOptionsChange: onOptionsChange, options: options }, 'serviceMap', {
                            datasourceUid: ds.uid,
                        });
                    } })),
            React.createElement(Button, { type: 'button', variant: 'secondary', size: 'sm', fill: 'text', onClick: function () {
                    updateDatasourcePluginJsonDataOption({ onOptionsChange: onOptionsChange, options: options }, 'serviceMap', {
                        datasourceUid: undefined,
                    });
                } }, "Clear"))));
}
var getStyles = function (theme) { return ({
    infoText: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    label: infoText;\n    padding-bottom: ", ";\n    color: ", ";\n  "], ["\n    label: infoText;\n    padding-bottom: ", ";\n    color: ", ";\n  "])), theme.spacing.md, theme.colors.textSemiWeak),
    row: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    label: row;\n    align-items: baseline;\n  "], ["\n    label: row;\n    align-items: baseline;\n  "]))),
}); };
var templateObject_1, templateObject_2;
//# sourceMappingURL=ServiceGraphSettings.js.map