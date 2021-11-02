import { __makeTemplateObject, __read } from "tslib";
import React, { useState } from 'react';
import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import { getDefaultRelativeTimeRange, LoadingState, } from '@grafana/data';
import { RelativeTimeRangePicker, useStyles2 } from '@grafana/ui';
import { QueryEditorRow } from 'app/features/query/components/QueryEditorRow';
import { VizWrapper } from './VizWrapper';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { TABLE, TIMESERIES } from '../../utils/constants';
export var QueryWrapper = function (_a) {
    var data = _a.data, dsSettings = _a.dsSettings, index = _a.index, onChangeDataSource = _a.onChangeDataSource, onChangeQuery = _a.onChangeQuery, onChangeTimeRange = _a.onChangeTimeRange, onRunQueries = _a.onRunQueries, onRemoveQuery = _a.onRemoveQuery, onDuplicateQuery = _a.onDuplicateQuery, query = _a.query, queries = _a.queries, thresholds = _a.thresholds, onChangeThreshold = _a.onChangeThreshold;
    var styles = useStyles2(getStyles);
    var isExpression = isExpressionQuery(query.model);
    var _b = __read(useState(isExpression ? TABLE : TIMESERIES), 2), pluginId = _b[0], changePluginId = _b[1];
    var renderTimePicker = function (query, index) {
        var _a;
        if (isExpressionQuery(query.model) || !onChangeTimeRange) {
            return null;
        }
        return (React.createElement(RelativeTimeRangePicker, { timeRange: (_a = query.relativeTimeRange) !== null && _a !== void 0 ? _a : getDefaultRelativeTimeRange(), onChange: function (range) { return onChangeTimeRange(range, index); } }));
    };
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement(QueryEditorRow, { dataSource: dsSettings, onChangeDataSource: !isExpression ? function (settings) { return onChangeDataSource(settings, index); } : undefined, id: query.refId, index: index, key: query.refId, data: data, query: cloneDeep(query.model), onChange: function (query) { return onChangeQuery(query, index); }, onRemoveQuery: onRemoveQuery, onAddQuery: onDuplicateQuery, onRunQuery: onRunQueries, queries: queries, renderHeaderExtras: function () { return renderTimePicker(query, index); }, visualization: data.state !== LoadingState.NotStarted ? (React.createElement(VizWrapper, { data: data, changePanel: changePluginId, currentPanel: pluginId, thresholds: thresholds, onThresholdsChange: function (thresholds) { return onChangeThreshold(thresholds, index); } })) : null, hideDisableQuery: true })));
};
var getStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    label: AlertingQueryWrapper;\n    margin-bottom: ", ";\n    border: 1px solid ", ";\n    border-radius: ", ";\n    padding-bottom: ", ";\n  "], ["\n    label: AlertingQueryWrapper;\n    margin-bottom: ", ";\n    border: 1px solid ", ";\n    border-radius: ", ";\n    padding-bottom: ", ";\n  "])), theme.spacing(1), theme.colors.border.medium, theme.shape.borderRadius(1), theme.spacing(1)),
}); };
var templateObject_1;
//# sourceMappingURL=QueryWrapper.js.map