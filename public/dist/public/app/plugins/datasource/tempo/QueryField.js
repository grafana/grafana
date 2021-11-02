import { __assign, __awaiter, __extends, __generator, __read } from "tslib";
import { css } from '@emotion/css';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { Badge, FileDropzone, InlineField, InlineFieldRow, InlineLabel, QueryField, RadioButtonGroup, withTheme2, } from '@grafana/ui';
import React from 'react';
import { LokiQueryField } from '../loki/components/LokiQueryField';
import useAsync from 'react-use/lib/useAsync';
import NativeSearch from './NativeSearch';
var DEFAULT_QUERY_TYPE = 'traceId';
var TempoQueryFieldComponent = /** @class */ (function (_super) {
    __extends(TempoQueryFieldComponent, _super);
    function TempoQueryFieldComponent(props) {
        var _this = _super.call(this, props) || this;
        _this.state = {
            linkedDatasourceUid: undefined,
            linkedDatasource: undefined,
            serviceMapDatasourceUid: undefined,
            serviceMapDatasource: undefined,
        };
        _this.onChangeLinkedQuery = function (value) {
            var _a = _this.props, query = _a.query, onChange = _a.onChange;
            onChange(__assign(__assign({}, query), { linkedQuery: __assign(__assign({}, value), { refId: 'linked' }) }));
        };
        _this.onRunLinkedQuery = function () {
            _this.props.onRunQuery();
        };
        return _this;
    }
    TempoQueryFieldComponent.prototype.componentDidMount = function () {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var datasource, tracesToLogsOptions, linkedDatasourceUid, serviceMapDsUid, _b, logsDs, serviceMapDs;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        datasource = this.props.datasource;
                        tracesToLogsOptions = datasource.tracesToLogs || {};
                        linkedDatasourceUid = tracesToLogsOptions.datasourceUid;
                        serviceMapDsUid = (_a = datasource.serviceMap) === null || _a === void 0 ? void 0 : _a.datasourceUid;
                        return [4 /*yield*/, Promise.all([getDS(linkedDatasourceUid), getDS(serviceMapDsUid)])];
                    case 1:
                        _b = __read.apply(void 0, [_c.sent(), 2]), logsDs = _b[0], serviceMapDs = _b[1];
                        this.setState({
                            linkedDatasourceUid: linkedDatasourceUid,
                            linkedDatasource: logsDs,
                            serviceMapDatasourceUid: serviceMapDsUid,
                            serviceMapDatasource: serviceMapDs,
                        });
                        // Set initial query type to ensure traceID field appears
                        if (!this.props.query.queryType) {
                            this.props.onChange(__assign(__assign({}, this.props.query), { queryType: DEFAULT_QUERY_TYPE }));
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    TempoQueryFieldComponent.prototype.render = function () {
        var _this = this;
        var _a, _b;
        var _c = this.props, query = _c.query, onChange = _c.onChange, datasource = _c.datasource;
        // Find query field from linked datasource
        var tracesToLogsOptions = datasource.tracesToLogs || {};
        var logsDatasourceUid = tracesToLogsOptions.datasourceUid;
        var graphDatasourceUid = (_a = datasource.serviceMap) === null || _a === void 0 ? void 0 : _a.datasourceUid;
        var queryTypeOptions = [
            { value: 'traceId', label: 'TraceID' },
            { value: 'upload', label: 'JSON file' },
        ];
        if (config.featureToggles.tempoServiceGraph) {
            queryTypeOptions.push({ value: 'serviceMap', label: 'Service Graph' });
        }
        if (config.featureToggles.tempoSearch && !((_b = datasource === null || datasource === void 0 ? void 0 : datasource.search) === null || _b === void 0 ? void 0 : _b.hide)) {
            queryTypeOptions.unshift({ value: 'nativeSearch', label: 'Search - Beta' });
        }
        if (logsDatasourceUid && (tracesToLogsOptions === null || tracesToLogsOptions === void 0 ? void 0 : tracesToLogsOptions.lokiSearch) !== false) {
            if (!config.featureToggles.tempoSearch) {
                // Place at beginning as Search if no native search
                queryTypeOptions.unshift({ value: 'search', label: 'Search' });
            }
            else {
                // Place at end as Loki Search if native search is enabled
                queryTypeOptions.push({ value: 'search', label: 'Loki Search' });
            }
        }
        return (React.createElement(React.Fragment, null,
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Query type" },
                    React.createElement(RadioButtonGroup, { options: queryTypeOptions, value: query.queryType, onChange: function (v) {
                            return onChange(__assign(__assign({}, query), { queryType: v }));
                        }, size: "md" })),
                query.queryType === 'nativeSearch' && (React.createElement("p", null,
                    React.createElement(Badge, { icon: "rocket", text: "Beta", color: "blue" }),
                    "\u00A0Tempo search is currently in beta and is designed to return recent traces only. It ignores the time range picker. We are actively working on full backend search. Look for improvements in the near future!"))),
            query.queryType === 'search' && (React.createElement(SearchSection, { linkedDatasourceUid: logsDatasourceUid, query: query, onRunQuery: this.onRunLinkedQuery, onChange: this.onChangeLinkedQuery })),
            query.queryType === 'nativeSearch' && (React.createElement(NativeSearch, { datasource: this.props.datasource, query: query, onChange: onChange, onBlur: this.props.onBlur, onRunQuery: this.props.onRunQuery })),
            query.queryType === 'upload' && (React.createElement("div", { className: css({ padding: this.props.theme.spacing(2) }) },
                React.createElement(FileDropzone, { options: { multiple: false }, onLoad: function (result) {
                        _this.props.datasource.uploadedJson = result;
                        _this.props.onRunQuery();
                    } }))),
            query.queryType === 'traceId' && (React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Trace ID", labelWidth: 14, grow: true },
                    React.createElement(QueryField, { query: query.query, onChange: function (val) {
                            onChange(__assign(__assign({}, query), { query: val, queryType: 'traceId', linkedQuery: undefined }));
                        }, onBlur: this.props.onBlur, onRunQuery: this.props.onRunQuery, placeholder: 'Enter a Trace ID (run with Shift+Enter)', portalOrigin: "tempo" })))),
            query.queryType === 'serviceMap' && React.createElement(ServiceGraphSection, { graphDatasourceUid: graphDatasourceUid })));
    };
    return TempoQueryFieldComponent;
}(React.PureComponent));
function ServiceGraphSection(_a) {
    var graphDatasourceUid = _a.graphDatasourceUid;
    var dsState = useAsync(function () { return getDS(graphDatasourceUid); }, [graphDatasourceUid]);
    if (dsState.loading) {
        return null;
    }
    var ds = dsState.value;
    if (!graphDatasourceUid) {
        return React.createElement("div", { className: "text-warning" }, "Please set up a service graph datasource in the datasource settings.");
    }
    if (graphDatasourceUid && !ds) {
        return (React.createElement("div", { className: "text-warning" }, "Service graph datasource is configured but the data source no longer exists. Please configure existing data source to use the service graph functionality."));
    }
    return null;
}
function SearchSection(_a) {
    var _b;
    var linkedDatasourceUid = _a.linkedDatasourceUid, onChange = _a.onChange, onRunQuery = _a.onRunQuery, query = _a.query;
    var dsState = useAsync(function () { return getDS(linkedDatasourceUid); }, [linkedDatasourceUid]);
    if (dsState.loading) {
        return null;
    }
    var ds = dsState.value;
    if (ds) {
        return (React.createElement(React.Fragment, null,
            React.createElement(InlineLabel, null,
                "Tempo uses ",
                ds.name,
                " to find traces."),
            React.createElement(LokiQueryField, { datasource: ds, onChange: onChange, onRunQuery: onRunQuery, query: (_b = query.linkedQuery) !== null && _b !== void 0 ? _b : { refId: 'linked' }, history: [] })));
    }
    if (!linkedDatasourceUid) {
        return React.createElement("div", { className: "text-warning" }, "Please set up a Traces-to-logs datasource in the datasource settings.");
    }
    if (linkedDatasourceUid && !ds) {
        return (React.createElement("div", { className: "text-warning" }, "Traces-to-logs datasource is configured but the data source no longer exists. Please configure existing data source to use the search."));
    }
    return null;
}
function getDS(uid) {
    return __awaiter(this, void 0, void 0, function () {
        var dsSrv, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!uid) {
                        return [2 /*return*/, undefined];
                    }
                    dsSrv = getDataSourceSrv();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, dsSrv.get(uid)];
                case 2: return [2 /*return*/, _a.sent()];
                case 3:
                    error_1 = _a.sent();
                    console.error('Failed to load data source', error_1);
                    return [2 /*return*/, undefined];
                case 4: return [2 /*return*/];
            }
        });
    });
}
export var TempoQueryField = withTheme2(TempoQueryFieldComponent);
//# sourceMappingURL=QueryField.js.map