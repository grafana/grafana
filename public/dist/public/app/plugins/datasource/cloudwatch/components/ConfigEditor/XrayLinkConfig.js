import { css } from '@emotion/css';
import React from 'react';
import { Alert, InlineField, useStyles2 } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
const getStyles = (theme) => ({
    infoText: css `
    padding-bottom: ${theme.spacing(2)};
    color: ${theme.colors.text.secondary};
  `,
});
const xRayDsId = 'grafana-x-ray-datasource';
export function XrayLinkConfig({ datasourceUid, onChange }) {
    const hasXrayDatasource = Boolean(getDatasourceSrv().getList({ pluginId: xRayDsId }).length);
    const styles = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("h3", { className: "page-heading" }, "X-ray trace link"),
        React.createElement("div", { className: styles.infoText }, "Grafana will automatically create a link to a trace in X-ray data source if logs contain @xrayTraceId field"),
        !hasXrayDatasource && (React.createElement(Alert, { title: 'There is no X-ray datasource to link to. First add an X-ray data source and then link it to Cloud Watch. ', severity: "info" })),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement(InlineField, { htmlFor: "data-source-picker", label: "Data source", labelWidth: 28, tooltip: "X-ray data source containing traces" },
                React.createElement(DataSourcePicker, { pluginId: xRayDsId, onChange: (ds) => onChange(ds.uid), current: datasourceUid, noDefault: true })))));
}
//# sourceMappingURL=XrayLinkConfig.js.map