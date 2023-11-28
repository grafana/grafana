import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { useAsync } from 'react-use';
import { CoreApp, LoadingState } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { isPromOrLokiQuery } from '../../utils/rule-form';
import { VizWrapper } from './VizWrapper';
export const RecordingRuleEditor = ({ queries, onChangeQuery, runQueries, panelData, dataSourceName, }) => {
    var _a;
    const [data, setData] = useState({
        series: [],
        state: LoadingState.NotStarted,
        timeRange: getTimeSrv().timeRange(),
    });
    const styles = useStyles2(getStyles);
    useEffect(() => {
        var _a;
        setData(panelData === null || panelData === void 0 ? void 0 : panelData[(_a = queries[0]) === null || _a === void 0 ? void 0 : _a.refId]);
    }, [panelData, queries]);
    const { error, loading, value: dataSource, } = useAsync(() => {
        return getDataSourceSrv().get(dataSourceName);
    }, [dataSourceName]);
    const handleChangedQuery = (changedQuery) => {
        var _a;
        const query = queries[0];
        const dataSourceId = (_a = getDataSourceSrv().getInstanceSettings(dataSourceName)) === null || _a === void 0 ? void 0 : _a.uid;
        if (!isPromOrLokiQuery(changedQuery) || !dataSourceId) {
            return;
        }
        const expr = changedQuery.expr;
        const merged = Object.assign(Object.assign(Object.assign({}, query), changedQuery), { datasourceUid: dataSourceId, expr, model: {
                expr,
                datasource: changedQuery.datasource,
                refId: changedQuery.refId,
                editorMode: changedQuery.editorMode,
                instant: Boolean(changedQuery.instant),
                range: Boolean(changedQuery.range),
                legendFormat: changedQuery.legendFormat,
            } });
        onChangeQuery([merged]);
    };
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
    const QueryEditor = dataSource.components.QueryEditor;
    return (React.createElement(React.Fragment, null,
        queries.length && (React.createElement(QueryEditor, { query: queries[0], queries: queries, app: CoreApp.UnifiedAlerting, onChange: handleChangedQuery, onRunQuery: runQueries, datasource: dataSource })),
        data && (React.createElement("div", { className: styles.vizWrapper },
            React.createElement(VizWrapper, { data: data })))));
};
const getStyles = (theme) => ({
    vizWrapper: css `
    margin: ${theme.spacing(1, 0)};
  `,
});
//# sourceMappingURL=RecordingRuleEditor.js.map