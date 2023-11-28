import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import { noop } from 'lodash';
import React, { useCallback, useMemo } from 'react';
import { useAsync } from 'react-use';
import { CoreApp, DataSourcePluginContextProvider, LoadingState } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { Alert, Button, useStyles2 } from '@grafana/ui';
import { CloudAlertPreview } from './CloudAlertPreview';
import { usePreview } from './PreviewRule';
export const ExpressionEditor = ({ value, onChange, dataSourceName, showPreviewAlertsButton = true, }) => {
    var _a, _b, _c, _d;
    const styles = useStyles2(getStyles);
    const { mapToValue, mapToQuery } = useQueryMappers(dataSourceName);
    const dataQuery = mapToQuery({ refId: 'A', hide: false }, value);
    const { error, loading, value: dataSource, } = useAsync(() => {
        return getDataSourceSrv().get(dataSourceName);
    }, [dataSourceName]);
    const onChangeQuery = useCallback((query) => {
        onChange(mapToValue(query));
    }, [onChange, mapToValue]);
    const [alertPreview, onPreview] = usePreview();
    const onRunQueriesClick = () => __awaiter(void 0, void 0, void 0, function* () {
        onPreview();
    });
    if (loading || (dataSource === null || dataSource === void 0 ? void 0 : dataSource.name) !== dataSourceName) {
        return null;
    }
    const dsi = getDataSourceSrv().getInstanceSettings(dataSourceName);
    if (error || !dataSource || !((_a = dataSource === null || dataSource === void 0 ? void 0 : dataSource.components) === null || _a === void 0 ? void 0 : _a.QueryEditor) || !dsi) {
        const errorMessage = (error === null || error === void 0 ? void 0 : error.message) || 'Data source plugin does not export any Query Editor component';
        return React.createElement("div", null,
            "Could not load query editor due to: ",
            errorMessage);
    }
    const previewLoaded = (alertPreview === null || alertPreview === void 0 ? void 0 : alertPreview.data.state) === LoadingState.Done;
    const QueryEditor = (_b = dataSource === null || dataSource === void 0 ? void 0 : dataSource.components) === null || _b === void 0 ? void 0 : _b.QueryEditor;
    // The Preview endpoint returns the preview as a single-element array of data frames
    const previewDataFrame = (_d = (_c = alertPreview === null || alertPreview === void 0 ? void 0 : alertPreview.data) === null || _c === void 0 ? void 0 : _c.series) === null || _d === void 0 ? void 0 : _d.find((s) => s.name === 'evaluation results');
    // The preview API returns arrays with empty elements when there are no firing alerts
    const previewHasAlerts = previewDataFrame && previewDataFrame.fields.some((field) => field.values.length > 0);
    return (React.createElement(React.Fragment, null,
        React.createElement(DataSourcePluginContextProvider, { instanceSettings: dsi },
            React.createElement(QueryEditor, { query: dataQuery, queries: [dataQuery], app: CoreApp.CloudAlerting, onChange: onChangeQuery, onRunQuery: noop, datasource: dataSource })),
        showPreviewAlertsButton && (React.createElement("div", { className: styles.preview },
            React.createElement(Button, { type: "button", onClick: onRunQueriesClick, disabled: (alertPreview === null || alertPreview === void 0 ? void 0 : alertPreview.data.state) === LoadingState.Loading }, "Preview alerts"),
            previewLoaded && !previewHasAlerts && (React.createElement(Alert, { title: "Alerts preview", severity: "info", className: styles.previewAlert }, "There are no firing alerts for your query.")),
            previewHasAlerts && React.createElement(CloudAlertPreview, { preview: previewDataFrame })))));
};
const getStyles = (theme) => ({
    preview: css `
    padding: ${theme.spacing(2, 0)};
    max-width: ${theme.breakpoints.values.xl}px;
  `,
    previewAlert: css `
    margin: ${theme.spacing(1, 0)};
  `,
});
export function useQueryMappers(dataSourceName) {
    return useMemo(() => {
        const settings = getDataSourceSrv().getInstanceSettings(dataSourceName);
        switch (settings === null || settings === void 0 ? void 0 : settings.type) {
            case 'loki':
            case 'prometheus':
                return {
                    mapToValue: (query) => query.expr,
                    mapToQuery: (existing, value) => (Object.assign(Object.assign({}, existing), { expr: value })),
                };
            default:
                throw new Error(`${dataSourceName} is not supported as an expression editor`);
        }
    }, [dataSourceName]);
}
//# sourceMappingURL=ExpressionEditor.js.map