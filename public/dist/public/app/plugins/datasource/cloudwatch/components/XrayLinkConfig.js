import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { Alert, InlineField, useStyles2 } from '@grafana/ui';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { DataSourcePicker } from '@grafana/runtime';
var getStyles = function (theme) { return ({
    infoText: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    padding-bottom: ", ";\n    color: ", ";\n  "], ["\n    padding-bottom: ", ";\n    color: ", ";\n  "])), theme.spacing(2), theme.colors.text.secondary),
}); };
var xRayDsId = 'grafana-x-ray-datasource';
export function XrayLinkConfig(_a) {
    var datasourceUid = _a.datasourceUid, onChange = _a.onChange;
    var hasXrayDatasource = Boolean(getDatasourceSrv().getList({ pluginId: xRayDsId }).length);
    var styles = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("h3", { className: "page-heading" }, "X-ray trace link"),
        React.createElement("div", { className: styles.infoText }, "Grafana will automatically create a link to a trace in X-ray data source if logs contain @xrayTraceId field"),
        !hasXrayDatasource && (React.createElement(Alert, { title: 'There is no X-ray datasource to link to. First add an X-ray data source and then link it to Cloud Watch. ', severity: "info" })),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement(InlineField, { htmlFor: "data-source-picker", label: "Data source", labelWidth: 28, tooltip: "X-ray data source containing traces" },
                React.createElement(DataSourcePicker, { pluginId: xRayDsId, onChange: function (ds) { return onChange(ds.uid); }, current: datasourceUid, noDefault: true })))));
}
var templateObject_1;
//# sourceMappingURL=XrayLinkConfig.js.map