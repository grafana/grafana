import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React, { useState } from 'react';
import { CoreApp, LoadingState, } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Icon, InlineField, Input, Tooltip, useStyles2 } from '@grafana/ui';
import { QueryEditorRow } from 'app/features/query/components/QueryEditorRow';
import { msToSingleUnitDuration } from '../../utils/time';
import { ExpressionStatusIndicator } from '../expressions/ExpressionStatusIndicator';
import { QueryOptions } from './QueryOptions';
import { VizWrapper } from './VizWrapper';
export const DEFAULT_MAX_DATA_POINTS = 43200;
export const DEFAULT_MIN_INTERVAL = '1s';
export const QueryWrapper = ({ data, error, dsSettings, index, onChangeDataSource, onChangeQuery, onChangeTimeRange, onRunQueries, onRemoveQuery, onDuplicateQuery, query, queries, thresholds, thresholdsType, onChangeThreshold, condition, onSetCondition, onChangeQueryOptions, }) => {
    const styles = useStyles2(getStyles);
    const [dsInstance, setDsInstance] = useState();
    const defaults = (dsInstance === null || dsInstance === void 0 ? void 0 : dsInstance.getDefaultQuery) ? dsInstance.getDefaultQuery(CoreApp.UnifiedAlerting) : {};
    const queryWithDefaults = Object.assign(Object.assign({}, defaults), cloneDeep(query.model));
    function SelectingDataSourceTooltip() {
        const styles = useStyles2(getStyles);
        return (React.createElement("div", { className: styles.dsTooltip },
            React.createElement(Tooltip, { content: React.createElement(React.Fragment, null, "Not finding the data source you want? Some data sources are not supported for alerting. Click on the icon for more information.") },
                React.createElement(Icon, { name: "info-circle", onClick: () => window.open(' https://grafana.com/docs/grafana/latest/alerting/fundamentals/data-source-alerting/', '_blank') }))));
    }
    // TODO add a warning label here too when the data looks like time series data and is used as an alert condition
    function HeaderExtras({ query, error, index }) {
        const queryOptions = {
            maxDataPoints: query.model.maxDataPoints,
            minInterval: query.model.intervalMs ? msToSingleUnitDuration(query.model.intervalMs) : undefined,
        };
        const alertQueryOptions = {
            maxDataPoints: queryOptions.maxDataPoints,
            minInterval: queryOptions.minInterval,
        };
        const isAlertCondition = condition === query.refId;
        return (React.createElement(Stack, { direction: "row", alignItems: "center", gap: 1 },
            React.createElement(SelectingDataSourceTooltip, null),
            React.createElement(QueryOptions, { onChangeTimeRange: onChangeTimeRange, query: query, queryOptions: alertQueryOptions, onChangeQueryOptions: onChangeQueryOptions, index: index }),
            React.createElement(ExpressionStatusIndicator, { error: error, onSetCondition: () => onSetCondition(query.refId), isCondition: isAlertCondition })));
    }
    const showVizualisation = data.state !== LoadingState.NotStarted;
    return (React.createElement(Stack, { direction: "column", gap: 0.5 },
        React.createElement("div", { className: styles.wrapper },
            React.createElement(QueryEditorRow, { alerting: true, collapsable: false, dataSource: dsSettings, onDataSourceLoaded: setDsInstance, onChangeDataSource: (settings) => onChangeDataSource(settings, index), id: query.refId, index: index, key: query.refId, data: data, query: queryWithDefaults, onChange: (query) => onChangeQuery(query, index), onRemoveQuery: onRemoveQuery, onAddQuery: () => onDuplicateQuery(cloneDeep(query)), onRunQuery: onRunQueries, queries: queries, renderHeaderExtras: () => React.createElement(HeaderExtras, { query: query, index: index, error: error }), app: CoreApp.UnifiedAlerting, hideDisableQuery: true })),
        showVizualisation && (React.createElement(VizWrapper, { data: data, thresholds: thresholds, thresholdsType: thresholdsType, onThresholdsChange: onChangeThreshold ? (thresholds) => onChangeThreshold(thresholds, index) : undefined }))));
};
export const EmptyQueryWrapper = ({ children }) => {
    const styles = useStyles2(getStyles);
    return React.createElement("div", { className: styles.wrapper }, children);
};
export function MaxDataPointsOption({ options, onChange, }) {
    var _a;
    const value = (_a = options.maxDataPoints) !== null && _a !== void 0 ? _a : '';
    const onMaxDataPointsBlur = (event) => {
        const maxDataPointsNumber = parseInt(event.target.value, 10);
        const maxDataPoints = isNaN(maxDataPointsNumber) || maxDataPointsNumber === 0 ? undefined : maxDataPointsNumber;
        if (maxDataPoints !== options.maxDataPoints) {
            onChange(Object.assign(Object.assign({}, options), { maxDataPoints }));
        }
    };
    return (React.createElement(InlineField, { labelWidth: 24, label: "Max data points", tooltip: "The maximum data points per series. Used directly by some data sources and used in calculation of auto interval. With streaming data this value is used for the rolling buffer." },
        React.createElement(Input, { type: "number", width: 10, placeholder: DEFAULT_MAX_DATA_POINTS.toLocaleString(), spellCheck: false, onBlur: onMaxDataPointsBlur, defaultValue: value })));
}
export function MinIntervalOption({ options, onChange, }) {
    var _a;
    const value = (_a = options.minInterval) !== null && _a !== void 0 ? _a : '';
    const onMinIntervalBlur = (event) => {
        const minInterval = event.target.value;
        if (minInterval !== value) {
            onChange(Object.assign(Object.assign({}, options), { minInterval }));
        }
    };
    return (React.createElement(InlineField, { label: "Min interval", labelWidth: 24, tooltip: React.createElement(React.Fragment, null,
            "A lower limit for the interval. Recommended to be set to write frequency, for example ",
            React.createElement("code", null, "1m"),
            " if your data is written every minute.") },
        React.createElement(Input, { type: "text", width: 10, placeholder: DEFAULT_MIN_INTERVAL, spellCheck: false, onBlur: onMinIntervalBlur, defaultValue: value })));
}
const getStyles = (theme) => ({
    wrapper: css `
    label: AlertingQueryWrapper;
    margin-bottom: ${theme.spacing(1)};
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};

    button {
      overflow: visible;
    }
  `,
    dsTooltip: css `
    display: flex;
    align-items: center;
    &:hover {
      opacity: 0.85;
      cursor: pointer;
    }
  `,
});
//# sourceMappingURL=QueryWrapper.js.map