import { __assign, __read } from "tslib";
import React, { useState, useEffect, useCallback } from 'react';
import { Project, VisualMetricQueryEditor, AliasBy } from '.';
import { EditorMode, MetricKind, PreprocessorType, AlignmentTypes, ValueTypes, } from '../types';
import { getAlignmentPickerData } from '../functions';
import { MQLQueryEditor } from './MQLQueryEditor';
export var defaultState = {
    labels: {},
};
export var defaultQuery = function (dataSource) { return ({
    editorMode: EditorMode.Visual,
    projectName: dataSource.getDefaultProject(),
    metricType: '',
    metricKind: MetricKind.GAUGE,
    valueType: '',
    crossSeriesReducer: 'REDUCE_MEAN',
    alignmentPeriod: 'cloud-monitoring-auto',
    perSeriesAligner: AlignmentTypes.ALIGN_MEAN,
    groupBys: [],
    filters: [],
    aliasBy: '',
    query: '',
    preprocessor: PreprocessorType.None,
}); };
function Editor(_a) {
    var refId = _a.refId, query = _a.query, datasource = _a.datasource, onQueryChange = _a.onChange, onRunQuery = _a.onRunQuery, customMetaData = _a.customMetaData, variableOptionGroup = _a.variableOptionGroup;
    var _b = __read(useState(defaultState), 2), state = _b[0], setState = _b[1];
    var projectName = query.projectName, metricType = query.metricType, groupBys = query.groupBys, editorMode = query.editorMode;
    useEffect(function () {
        if (projectName && metricType) {
            datasource
                .getLabels(metricType, refId, projectName, groupBys)
                .then(function (labels) { return setState(function (prevState) { return (__assign(__assign({}, prevState), { labels: labels })); }); });
        }
    }, [datasource, groupBys, metricType, projectName, refId]);
    var onChange = useCallback(function (metricQuery) {
        onQueryChange(__assign(__assign({}, query), metricQuery));
        onRunQuery();
    }, [onQueryChange, onRunQuery, query]);
    var onMetricTypeChange = useCallback(function (_a) {
        var valueType = _a.valueType, metricKind = _a.metricKind, type = _a.type;
        var preprocessor = metricKind === MetricKind.GAUGE || valueType === ValueTypes.DISTRIBUTION
            ? PreprocessorType.None
            : PreprocessorType.Rate;
        var perSeriesAligner = getAlignmentPickerData(valueType, metricKind, state.perSeriesAligner, preprocessor).perSeriesAligner;
        onChange(__assign(__assign({}, query), { perSeriesAligner: perSeriesAligner, metricType: type, valueType: valueType, metricKind: metricKind, preprocessor: preprocessor }));
    }, [onChange, query, state]);
    return (React.createElement(React.Fragment, null,
        React.createElement(Project, { templateVariableOptions: variableOptionGroup.options, projectName: projectName, datasource: datasource, onChange: function (projectName) {
                onChange(__assign(__assign({}, query), { projectName: projectName }));
            } }),
        editorMode === EditorMode.Visual && (React.createElement(VisualMetricQueryEditor, { labels: state.labels, variableOptionGroup: variableOptionGroup, customMetaData: customMetaData, onMetricTypeChange: onMetricTypeChange, onChange: onChange, datasource: datasource, query: query })),
        editorMode === EditorMode.MQL && (React.createElement(MQLQueryEditor, { onChange: function (q) { return onQueryChange(__assign(__assign({}, query), { query: q })); }, onRunQuery: onRunQuery, query: query.query })),
        React.createElement(AliasBy, { value: query.aliasBy, onChange: function (aliasBy) {
                onChange(__assign(__assign({}, query), { aliasBy: aliasBy }));
            } })));
}
export var MetricQueryEditor = React.memo(Editor);
//# sourceMappingURL=MetricQueryEditor.js.map