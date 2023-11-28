import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { useCallback, useState } from 'react';
import { dateTimeFormat, isTimeSeriesFrames, LoadingState } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { AutoSizeInput, Button, clearButtonStyles, IconButton, useStyles2 } from '@grafana/ui';
import { ClassicConditions } from 'app/features/expressions/components/ClassicConditions';
import { Math } from 'app/features/expressions/components/Math';
import { Reduce } from 'app/features/expressions/components/Reduce';
import { Resample } from 'app/features/expressions/components/Resample';
import { Threshold } from 'app/features/expressions/components/Threshold';
import { ExpressionQueryType, expressionTypes, getExpressionLabel, } from 'app/features/expressions/types';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { usePagination } from '../../hooks/usePagination';
import { HoverCard } from '../HoverCard';
import { Spacer } from '../Spacer';
import { AlertStateTag } from '../rules/AlertStateTag';
import { ExpressionStatusIndicator } from './ExpressionStatusIndicator';
import { formatLabels, getSeriesLabels, getSeriesName, getSeriesValue, isEmptySeries } from './util';
export const Expression = ({ queries = [], query, data, error, warning, isAlertCondition, onSetCondition, onUpdateRefId, onRemoveExpression, onUpdateExpressionType, onChangeQuery, }) => {
    var _a, _b;
    const styles = useStyles2(getStyles);
    const queryType = query === null || query === void 0 ? void 0 : query.type;
    const isLoading = data && Object.values(data).some((d) => Boolean(d) && d.state === LoadingState.Loading);
    const hasResults = Array.isArray(data === null || data === void 0 ? void 0 : data.series) && !isLoading;
    const series = (_a = data === null || data === void 0 ? void 0 : data.series) !== null && _a !== void 0 ? _a : [];
    const seriesCount = series.length;
    const alertCondition = isAlertCondition !== null && isAlertCondition !== void 0 ? isAlertCondition : false;
    const groupedByState = {
        [PromAlertingRuleState.Firing]: series.filter((serie) => getSeriesValue(serie) !== 0),
        [PromAlertingRuleState.Inactive]: series.filter((serie) => getSeriesValue(serie) === 0),
    };
    const renderExpressionType = useCallback((query) => {
        // these are the refs we can choose from that don't include the current one
        const availableRefIds = queries
            .filter((q) => query.refId !== q.refId)
            .map((q) => ({ value: q.refId, label: q.refId }));
        switch (query.type) {
            case ExpressionQueryType.math:
                return React.createElement(Math, { onChange: onChangeQuery, query: query, labelWidth: 'auto', onRunQuery: () => { } });
            case ExpressionQueryType.reduce:
                return React.createElement(Reduce, { onChange: onChangeQuery, refIds: availableRefIds, labelWidth: 'auto', query: query });
            case ExpressionQueryType.resample:
                return React.createElement(Resample, { onChange: onChangeQuery, query: query, labelWidth: 'auto', refIds: availableRefIds });
            case ExpressionQueryType.classic:
                return React.createElement(ClassicConditions, { onChange: onChangeQuery, query: query, refIds: availableRefIds });
            case ExpressionQueryType.threshold:
                return React.createElement(Threshold, { onChange: onChangeQuery, query: query, labelWidth: 'auto', refIds: availableRefIds });
            default:
                return React.createElement(React.Fragment, null,
                    "Expression not supported: ",
                    query.type);
        }
    }, [onChangeQuery, queries]);
    const selectedExpressionType = expressionTypes.find((o) => o.value === queryType);
    const selectedExpressionDescription = (_b = selectedExpressionType === null || selectedExpressionType === void 0 ? void 0 : selectedExpressionType.description) !== null && _b !== void 0 ? _b : '';
    return (React.createElement("div", { className: cx(styles.expression.wrapper, alertCondition && styles.expression.alertCondition, queryType === ExpressionQueryType.classic && styles.expression.classic, queryType !== ExpressionQueryType.classic && styles.expression.nonClassic) },
        React.createElement("div", { className: styles.expression.stack },
            React.createElement(Header, { refId: query.refId, queryType: queryType, onRemoveExpression: () => onRemoveExpression(query.refId), onUpdateRefId: (newRefId) => onUpdateRefId(query.refId, newRefId), onUpdateExpressionType: (type) => onUpdateExpressionType(query.refId, type), onSetCondition: onSetCondition, warning: warning, error: error, query: query, alertCondition: alertCondition }),
            React.createElement("div", { className: styles.expression.body },
                React.createElement("div", { className: styles.expression.description }, selectedExpressionDescription),
                renderExpressionType(query)),
            hasResults && (React.createElement(React.Fragment, null,
                React.createElement(ExpressionResult, { series: series, isAlertCondition: isAlertCondition }),
                React.createElement("div", { className: styles.footer },
                    React.createElement(Stack, { direction: "row", alignItems: "center" },
                        React.createElement(Spacer, null),
                        React.createElement(PreviewSummary, { isCondition: Boolean(isAlertCondition), firing: groupedByState[PromAlertingRuleState.Firing].length, normal: groupedByState[PromAlertingRuleState.Inactive].length, seriesCount: seriesCount }))))))));
};
export const PAGE_SIZE = 20;
export const ExpressionResult = ({ series, isAlertCondition }) => {
    const { pageItems, previousPage, nextPage, numberOfPages, pageStart, pageEnd } = usePagination(series, 1, PAGE_SIZE);
    const styles = useStyles2(getStyles);
    // sometimes we receive results where every value is just "null" when noData occurs
    const emptyResults = isEmptySeries(series);
    const isTimeSeriesResults = !emptyResults && isTimeSeriesFrames(series);
    const shouldShowPagination = numberOfPages > 1;
    return (React.createElement("div", { className: styles.expression.results },
        !emptyResults && isTimeSeriesResults && (React.createElement("div", null, pageItems.map((frame, index) => (React.createElement(TimeseriesRow, { key: uniqueId(), frame: frame, index: pageStart + index, isAlertCondition: isAlertCondition }))))),
        !emptyResults &&
            !isTimeSeriesResults &&
            pageItems.map((frame, index) => (
            // There's no way to uniquely identify a frame that doesn't cause render bugs :/ (Gilles)
            React.createElement(FrameRow, { key: uniqueId(), frame: frame, index: pageStart + index, isAlertCondition: isAlertCondition }))),
        emptyResults && React.createElement("div", { className: cx(styles.expression.noData, styles.mutedText) }, "No data"),
        shouldShowPagination && (React.createElement("div", { className: styles.pagination.wrapper, "data-testid": "paginate-expression" },
            React.createElement(Stack, null,
                React.createElement(Button, { variant: "secondary", fill: "outline", onClick: previousPage, icon: "angle-left", size: "sm", "aria-label": "previous-page" }),
                React.createElement(Spacer, null),
                React.createElement("span", { className: styles.mutedText },
                    pageStart,
                    " - ",
                    pageEnd,
                    " of ",
                    series.length),
                React.createElement(Spacer, null),
                React.createElement(Button, { variant: "secondary", fill: "outline", onClick: nextPage, icon: "angle-right", size: "sm", "aria-label": "next-page" }))))));
};
export const PreviewSummary = ({ firing, normal, isCondition, seriesCount, }) => {
    const { mutedText } = useStyles2(getStyles);
    if (seriesCount === 0) {
        return React.createElement("span", { className: mutedText }, "No series");
    }
    if (isCondition) {
        return React.createElement("span", { className: mutedText }, `${seriesCount} series: ${firing} firing, ${normal} normal`);
    }
    return React.createElement("span", { className: mutedText }, `${seriesCount} series`);
};
const Header = ({ refId, queryType, onUpdateRefId, onRemoveExpression, warning, onSetCondition, alertCondition, query, error, }) => {
    const styles = useStyles2(getStyles);
    const clearButton = useStyles2(clearButtonStyles);
    /**
     * There are 3 edit modes:
     *
     * 1. "refId": Editing the refId (ie. A -> B)
     * 2. "expressionType": Editing the type of the expression (ie. Reduce -> Math)
     * 3. "false": This means we're not editing either of those
     */
    const [editMode, setEditMode] = useState(false);
    const editing = editMode !== false;
    const editingRefId = editing && editMode === 'refId';
    return (React.createElement("header", { className: styles.header.wrapper },
        React.createElement(Stack, { direction: "row", gap: 0.5, alignItems: "center" },
            React.createElement(Stack, { direction: "row", gap: 1, alignItems: "center", wrap: false },
                !editingRefId && (React.createElement("button", { type: "button", className: cx(clearButton, styles.editable), onClick: () => setEditMode('refId') },
                    React.createElement("div", { className: styles.expression.refId }, refId))),
                editingRefId && (React.createElement(AutoSizeInput, { autoFocus: true, defaultValue: refId, minWidth: 5, onChange: (event) => {
                        onUpdateRefId(event.currentTarget.value);
                        setEditMode(false);
                    }, onFocus: (event) => event.target.select(), onBlur: (event) => {
                        onUpdateRefId(event.currentTarget.value);
                        setEditMode(false);
                    } })),
                React.createElement("div", null, getExpressionLabel(queryType))),
            React.createElement(Spacer, null),
            React.createElement(ExpressionStatusIndicator, { error: error, warning: warning, onSetCondition: () => onSetCondition(query.refId), isCondition: alertCondition }),
            React.createElement(IconButton, { name: "trash-alt", variant: "secondary", className: styles.mutedIcon, onClick: onRemoveExpression, tooltip: "Remove expression" }))));
};
const FrameRow = ({ frame, index, isAlertCondition }) => {
    const styles = useStyles2(getStyles);
    const name = getSeriesName(frame) || 'Series ' + index;
    const value = getSeriesValue(frame);
    const labelsRecord = getSeriesLabels(frame);
    const labels = Object.entries(labelsRecord);
    const hasLabels = labels.length > 0;
    const showFiring = isAlertCondition && value !== 0;
    const showNormal = isAlertCondition && value === 0;
    const title = `${hasLabels ? '' : name}${hasLabels ? `{${formatLabels(labelsRecord)}}` : ''}`;
    return (React.createElement("div", { className: styles.expression.resultsRow },
        React.createElement(Stack, { direction: "row", gap: 1, alignItems: "center" },
            React.createElement("div", { className: styles.expression.resultLabel, title: title },
                React.createElement("span", null, hasLabels ? '' : name),
                hasLabels && (React.createElement(React.Fragment, null,
                    React.createElement("span", null, '{'),
                    labels.map(([key, value], index) => (React.createElement("span", { key: uniqueId() },
                        React.createElement("span", { className: styles.expression.labelKey }, key),
                        React.createElement("span", null, "="),
                        React.createElement("span", null, "\""),
                        React.createElement("span", { className: styles.expression.labelValue }, value),
                        React.createElement("span", null, "\""),
                        index < labels.length - 1 && React.createElement("span", null, ", ")))),
                    React.createElement("span", null, '}')))),
            React.createElement("div", { className: styles.expression.resultValue }, value),
            showFiring && React.createElement(AlertStateTag, { state: PromAlertingRuleState.Firing, size: "sm" }),
            showNormal && React.createElement(AlertStateTag, { state: PromAlertingRuleState.Inactive, size: "sm" }))));
};
const TimeseriesRow = ({ frame, index }) => {
    var _a, _b;
    const styles = useStyles2(getStyles);
    const valueField = frame.fields[1]; // field 0 is "time", field 1 is "value"
    const hasLabels = valueField.labels;
    const displayNameFromDS = (_a = valueField.config) === null || _a === void 0 ? void 0 : _a.displayNameFromDS;
    const name = displayNameFromDS !== null && displayNameFromDS !== void 0 ? displayNameFromDS : (hasLabels ? formatLabels((_b = valueField.labels) !== null && _b !== void 0 ? _b : {}) : 'Series ' + index);
    const timestamps = frame.fields[0].values;
    const getTimestampFromIndex = (index) => frame.fields[0].values[index];
    const getValueFromIndex = (index) => frame.fields[1].values[index];
    return (React.createElement("div", { className: styles.expression.resultsRow },
        React.createElement(Stack, { direction: "row", alignItems: "center" },
            React.createElement("span", { className: cx(styles.mutedText, styles.expression.resultLabel), title: name }, name),
            React.createElement("div", { className: styles.expression.resultValue },
                React.createElement(HoverCard, { placement: "right", wrapperClassName: styles.timeseriesTableWrapper, content: React.createElement("table", { className: styles.timeseriesTable },
                        React.createElement("thead", null,
                            React.createElement("tr", null,
                                React.createElement("th", null, "Timestamp"),
                                React.createElement("th", null, "Value"))),
                        React.createElement("tbody", null, timestamps.map((_, index) => (React.createElement("tr", { key: index },
                            React.createElement("td", { className: styles.mutedText }, dateTimeFormat(getTimestampFromIndex(index))),
                            React.createElement("td", { className: styles.expression.resultValue }, getValueFromIndex(index))))))) },
                    React.createElement("span", null, "Time series data"))))));
};
const getStyles = (theme) => ({
    expression: {
        wrapper: css `
      display: flex;
      border: solid 1px ${theme.colors.border.medium};
      flex: 1;
      flex-basis: 400px;
      border-radius: ${theme.shape.radius.default};
    `,
        stack: css `
      display: flex;
      flex-direction: column;
      flex-wrap: nowrap;
      gap: 0;
      width: 100%;
      min-width: 0; // this one is important to prevent text overflow
    `,
        classic: css `
      max-width: 100%;
    `,
        nonClassic: css `
      max-width: 640px;
    `,
        alertCondition: css ``,
        body: css `
      padding: ${theme.spacing(1)};
      flex: 1;
    `,
        description: css `
      margin-bottom: ${theme.spacing(1)};
      font-size: ${theme.typography.size.xs};
      color: ${theme.colors.text.secondary};
    `,
        refId: css `
      font-weight: ${theme.typography.fontWeightBold};
      color: ${theme.colors.primary.text};
    `,
        results: css `
      display: flex;
      flex-direction: column;
      flex-wrap: nowrap;

      border-top: solid 1px ${theme.colors.border.medium};
    `,
        noResults: css `
      display: flex;
      align-items: center;
      justify-content: center;
    `,
        resultsRow: css `
      padding: ${theme.spacing(0.75)} ${theme.spacing(1)};

      &:nth-child(odd) {
        background-color: ${theme.colors.background.secondary};
      }

      &:hover {
        background-color: ${theme.colors.background.canvas};
      }
    `,
        labelKey: css `
      color: ${theme.isDark ? '#73bf69' : '#56a64b'};
    `,
        labelValue: css `
      color: ${theme.isDark ? '#ce9178' : '#a31515'};
    `,
        resultValue: css `
      text-align: right;
    `,
        resultLabel: css `
      flex: 1;
      overflow-x: auto;

      display: inline-block;
      white-space: nowrap;
    `,
        noData: css `
      display: flex;
      align-items: center;
      justify-content: center;
      padding: ${theme.spacing()};
    `,
    },
    mutedText: css `
    color: ${theme.colors.text.secondary};
    font-size: 0.9em;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
    header: {
        wrapper: css `
      background: ${theme.colors.background.secondary};
      padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
      border-bottom: solid 1px ${theme.colors.border.weak};
    `,
    },
    footer: css `
    background: ${theme.colors.background.secondary};
    padding: ${theme.spacing(1)};
    border-top: solid 1px ${theme.colors.border.weak};
  `,
    draggableIcon: css `
    cursor: grab;
  `,
    mutedIcon: css `
    color: ${theme.colors.text.secondary};
  `,
    editable: css `
    padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
    border: solid 1px ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};

    display: flex;
    flex-direction: row;
    align-items: center;
    gap: ${theme.spacing(1)};

    cursor: pointer;
  `,
    timeseriesTableWrapper: css `
    max-height: 500px;

    overflow-y: scroll;
  `,
    timeseriesTable: css `
    table-layout: auto;

    width: 100%;
    height: 100%;

    td,
    th {
      padding: ${theme.spacing(1)};
    }

    td {
      background: ${theme.colors.background.primary};
    }

    th {
      background: ${theme.colors.background.secondary};
    }

    tr {
      border-bottom: 1px solid ${theme.colors.border.medium};

      &:last-of-type {
        border-bottom: none;
      }
    }
  `,
    pagination: {
        wrapper: css `
      border-top: 1px solid ${theme.colors.border.medium};
      padding: ${theme.spacing()};
    `,
    },
});
//# sourceMappingURL=Expression.js.map