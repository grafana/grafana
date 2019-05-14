import * as tslib_1 from "tslib";
import React from 'react';
import { Metrics } from './Metrics';
import { Filter } from './Filter';
import { Aggregations } from './Aggregations';
import { Alignments } from './Alignments';
import { AlignmentPeriods } from './AlignmentPeriods';
import { AliasBy } from './AliasBy';
import { Help } from './Help';
import { getAlignmentPickerData } from '../functions';
export var DefaultTarget = {
    defaultProject: 'loading project...',
    metricType: '',
    metricKind: '',
    valueType: '',
    refId: '',
    service: '',
    unit: '',
    crossSeriesReducer: 'REDUCE_MEAN',
    alignmentPeriod: 'stackdriver-auto',
    perSeriesAligner: 'ALIGN_MEAN',
    groupBys: [],
    filters: [],
    aliasBy: '',
    alignOptions: [],
    lastQuery: '',
    lastQueryError: '',
    usedAlignmentPeriod: '',
};
var QueryEditor = /** @class */ (function (_super) {
    tslib_1.__extends(QueryEditor, _super);
    function QueryEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = DefaultTarget;
        _this.onMetricTypeChange = function (_a) {
            var valueType = _a.valueType, metricKind = _a.metricKind, type = _a.type, unit = _a.unit;
            var _b = _this.props, templateSrv = _b.templateSrv, onQueryChange = _b.onQueryChange, onExecuteQuery = _b.onExecuteQuery;
            var _c = getAlignmentPickerData({ valueType: valueType, metricKind: metricKind, perSeriesAligner: _this.state.perSeriesAligner }, templateSrv), perSeriesAligner = _c.perSeriesAligner, alignOptions = _c.alignOptions;
            _this.setState({
                alignOptions: alignOptions,
                perSeriesAligner: perSeriesAligner,
                metricType: type,
                unit: unit,
                valueType: valueType,
                metricKind: metricKind,
            }, function () {
                onQueryChange(_this.state);
                onExecuteQuery();
            });
        };
        return _this;
    }
    QueryEditor.prototype.componentDidMount = function () {
        var _a = this.props, events = _a.events, target = _a.target, templateSrv = _a.templateSrv;
        events.on('data-received', this.onDataReceived.bind(this));
        events.on('data-error', this.onDataError.bind(this));
        var _b = getAlignmentPickerData(target, templateSrv), perSeriesAligner = _b.perSeriesAligner, alignOptions = _b.alignOptions;
        this.setState(tslib_1.__assign({}, this.props.target, { alignOptions: alignOptions,
            perSeriesAligner: perSeriesAligner }));
    };
    QueryEditor.prototype.componentWillUnmount = function () {
        this.props.events.off('data-received', this.onDataReceived);
        this.props.events.off('data-error', this.onDataError);
    };
    QueryEditor.prototype.onDataReceived = function (dataList) {
        var _this = this;
        var series = dataList.find(function (item) { return item.refId === _this.props.target.refId; });
        if (series) {
            this.setState({
                lastQuery: decodeURIComponent(series.meta.rawQuery),
                lastQueryError: '',
                usedAlignmentPeriod: series.meta.alignmentPeriod,
            });
        }
    };
    QueryEditor.prototype.onDataError = function (err) {
        var lastQuery;
        var lastQueryError;
        if (err.data && err.data.error) {
            lastQueryError = this.props.datasource.formatStackdriverError(err);
        }
        else if (err.data && err.data.results) {
            var queryRes = err.data.results[this.props.target.refId];
            lastQuery = decodeURIComponent(queryRes.meta.rawQuery);
            if (queryRes && queryRes.error) {
                try {
                    lastQueryError = JSON.parse(queryRes.error).error.message;
                }
                catch (_a) {
                    lastQueryError = queryRes.error;
                }
            }
        }
        this.setState({ lastQuery: lastQuery, lastQueryError: lastQueryError });
    };
    QueryEditor.prototype.onPropertyChange = function (prop, value) {
        var _this = this;
        var _a;
        this.setState((_a = {}, _a[prop] = value, _a), function () {
            _this.props.onQueryChange(_this.state);
            _this.props.onExecuteQuery();
        });
    };
    QueryEditor.prototype.render = function () {
        var _this = this;
        var _a = this.state, usedAlignmentPeriod = _a.usedAlignmentPeriod, defaultProject = _a.defaultProject, metricType = _a.metricType, crossSeriesReducer = _a.crossSeriesReducer, groupBys = _a.groupBys, filters = _a.filters, perSeriesAligner = _a.perSeriesAligner, alignOptions = _a.alignOptions, alignmentPeriod = _a.alignmentPeriod, aliasBy = _a.aliasBy, lastQuery = _a.lastQuery, lastQueryError = _a.lastQueryError, refId = _a.refId;
        var _b = this.props, datasource = _b.datasource, templateSrv = _b.templateSrv;
        return (React.createElement(React.Fragment, null,
            React.createElement(Metrics, { defaultProject: defaultProject, metricType: metricType, templateSrv: templateSrv, datasource: datasource, onChange: this.onMetricTypeChange }, function (metric) { return (React.createElement(React.Fragment, null,
                React.createElement(Filter, { filtersChanged: function (value) { return _this.onPropertyChange('filters', value); }, groupBysChanged: function (value) { return _this.onPropertyChange('groupBys', value); }, filters: filters, groupBys: groupBys, refId: refId, hideGroupBys: false, templateSrv: templateSrv, datasource: datasource, metricType: metric ? metric.type : '' }),
                React.createElement(Aggregations, { metricDescriptor: metric, templateSrv: templateSrv, crossSeriesReducer: crossSeriesReducer, groupBys: groupBys, onChange: function (value) { return _this.onPropertyChange('crossSeriesReducer', value); } }, function (displayAdvancedOptions) {
                    return displayAdvancedOptions && (React.createElement(Alignments, { alignOptions: alignOptions, templateSrv: templateSrv, perSeriesAligner: perSeriesAligner, onChange: function (value) { return _this.onPropertyChange('perSeriesAligner', value); } }));
                }),
                React.createElement(AlignmentPeriods, { templateSrv: templateSrv, alignmentPeriod: alignmentPeriod, perSeriesAligner: perSeriesAligner, usedAlignmentPeriod: usedAlignmentPeriod, onChange: function (value) { return _this.onPropertyChange('alignmentPeriod', value); } }),
                React.createElement(AliasBy, { value: aliasBy, onChange: function (value) { return _this.onPropertyChange('aliasBy', value); } }),
                React.createElement(Help, { datasource: datasource, rawQuery: lastQuery, lastQueryError: lastQueryError }))); })));
    };
    return QueryEditor;
}(React.Component));
export { QueryEditor };
//# sourceMappingURL=QueryEditor.js.map