import React, { useCallback, useEffect, useState } from 'react';
import { EditorField, EditorRow, InlineSelect, Space } from '@grafana/experimental';
import { ConfirmModal, Input, RadioButtonGroup } from '@grafana/ui';
import useMigratedMetricsQuery from '../../../migrations/useMigratedMetricsQuery';
import { MetricEditorMode, MetricQueryType, } from '../../../types';
import { MetricStatEditor } from '../../shared/MetricStatEditor';
import { DynamicLabelsField } from './DynamicLabelsField';
import { MathExpressionQueryField } from './MathExpressionQueryField';
import { SQLBuilderEditor } from './SQLBuilderEditor';
import { SQLCodeEditor } from './SQLCodeEditor';
const metricEditorModes = [
    { label: 'Metric Search', value: MetricQueryType.Search },
    { label: 'Metric Query', value: MetricQueryType.Query },
];
const editorModes = [
    { label: 'Builder', value: MetricEditorMode.Builder },
    { label: 'Code', value: MetricEditorMode.Code },
];
export const MetricsQueryEditor = (props) => {
    var _a, _b, _c;
    const { query, datasource, extraHeaderElementLeft, extraHeaderElementRight, onChange } = props;
    const [showConfirm, setShowConfirm] = useState(false);
    const [sqlCodeEditorIsDirty, setSQLCodeEditorIsDirty] = useState(false);
    const migratedQuery = useMigratedMetricsQuery(query, props.onChange);
    const onEditorModeChange = useCallback((newMetricEditorMode) => {
        if (sqlCodeEditorIsDirty &&
            query.metricQueryType === MetricQueryType.Query &&
            query.metricEditorMode === MetricEditorMode.Code) {
            setShowConfirm(true);
            return;
        }
        onChange(Object.assign(Object.assign({}, query), { metricEditorMode: newMetricEditorMode }));
    }, [setShowConfirm, onChange, sqlCodeEditorIsDirty, query]);
    useEffect(() => {
        extraHeaderElementLeft === null || extraHeaderElementLeft === void 0 ? void 0 : extraHeaderElementLeft(React.createElement(InlineSelect, { "aria-label": "Metric editor mode", value: metricEditorModes.find((m) => m.value === query.metricQueryType), options: metricEditorModes, onChange: ({ value }) => {
                onChange(Object.assign(Object.assign({}, query), { metricQueryType: value }));
            } }));
        extraHeaderElementRight === null || extraHeaderElementRight === void 0 ? void 0 : extraHeaderElementRight(React.createElement(React.Fragment, null,
            React.createElement(RadioButtonGroup, { options: editorModes, size: "sm", value: query.metricEditorMode, onChange: onEditorModeChange }),
            React.createElement(ConfirmModal, { isOpen: showConfirm, title: "Are you sure?", body: "You will lose manual changes done to the query if you go back to the visual builder.", confirmText: "Yes, I am sure.", dismissText: "No, continue editing the query manually.", icon: "exclamation-triangle", onConfirm: () => {
                    setShowConfirm(false);
                    onChange(Object.assign(Object.assign({}, query), { metricEditorMode: MetricEditorMode.Builder }));
                }, onDismiss: () => setShowConfirm(false) })));
        return () => {
            extraHeaderElementLeft === null || extraHeaderElementLeft === void 0 ? void 0 : extraHeaderElementLeft(undefined);
            extraHeaderElementRight === null || extraHeaderElementRight === void 0 ? void 0 : extraHeaderElementRight(undefined);
        };
    }, [
        query,
        sqlCodeEditorIsDirty,
        datasource,
        onChange,
        extraHeaderElementLeft,
        extraHeaderElementRight,
        showConfirm,
        onEditorModeChange,
    ]);
    return (React.createElement(React.Fragment, null,
        React.createElement(Space, { v: 0.5 }),
        query.metricQueryType === MetricQueryType.Search && (React.createElement(React.Fragment, null,
            query.metricEditorMode === MetricEditorMode.Builder && (React.createElement(MetricStatEditor, Object.assign({}, props, { refId: query.refId, metricStat: query, onChange: (metricStat) => props.onChange(Object.assign(Object.assign({}, query), metricStat)) }))),
            query.metricEditorMode === MetricEditorMode.Code && (React.createElement(MathExpressionQueryField, { expression: (_a = query.expression) !== null && _a !== void 0 ? _a : '', onChange: (expression) => props.onChange(Object.assign(Object.assign({}, query), { expression })), datasource: datasource })))),
        query.metricQueryType === MetricQueryType.Query && (React.createElement(React.Fragment, null,
            query.metricEditorMode === MetricEditorMode.Code && (React.createElement(SQLCodeEditor, { region: query.region, sql: (_b = query.sqlExpression) !== null && _b !== void 0 ? _b : '', onChange: (sqlExpression) => {
                    if (!sqlCodeEditorIsDirty) {
                        setSQLCodeEditorIsDirty(true);
                    }
                    props.onChange(Object.assign(Object.assign({}, migratedQuery), { sqlExpression }));
                }, datasource: datasource })),
            query.metricEditorMode === MetricEditorMode.Builder && (React.createElement(React.Fragment, null,
                React.createElement(SQLBuilderEditor, { query: query, onChange: props.onChange, datasource: datasource }))))),
        React.createElement(Space, { v: 0.5 }),
        React.createElement(EditorRow, null,
            React.createElement(EditorField, { label: "ID", width: 26, optional: true, tooltip: "ID can be used to reference other queries in math expressions. The ID can include numbers, letters, and underscore, and must start with a lowercase letter.", invalid: !!query.id && !/^$|^[a-z][a-zA-Z0-9_]*$/.test(query.id) },
                React.createElement(Input, { id: `${query.refId}-cloudwatch-metric-query-editor-id`, onChange: (event) => onChange(Object.assign(Object.assign({}, migratedQuery), { id: event.target.value })), type: "text", value: query.id })),
            React.createElement(EditorField, { label: "Period", width: 26, tooltip: "Minimum interval between points in seconds." },
                React.createElement(Input, { id: `${query.refId}-cloudwatch-metric-query-editor-period`, value: query.period || '', placeholder: "auto", onChange: (event) => onChange(Object.assign(Object.assign({}, migratedQuery), { period: event.target.value })) })),
            React.createElement(EditorField, { label: "Label", width: 26, optional: true, tooltip: "Change time series legend name using Dynamic labels. See documentation for details." },
                React.createElement(DynamicLabelsField, { width: 52, label: (_c = migratedQuery.label) !== null && _c !== void 0 ? _c : '', onChange: (label) => props.onChange(Object.assign(Object.assign({}, query), { label })) })))));
};
//# sourceMappingURL=MetricsQueryEditor.js.map