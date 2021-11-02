import { __assign, __awaiter, __generator, __read } from "tslib";
import { css } from '@emotion/css';
import { ButtonCascader, FileDropzone, InlineField, InlineFieldRow, RadioButtonGroup, useTheme2, QueryField, } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';
import { fromPairs } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useAsyncFn, useMount, useMountedState } from 'react-use';
import { apiPrefix } from './constants';
export var ZipkinQueryField = function (_a) {
    var query = _a.query, onChange = _a.onChange, onRunQuery = _a.onRunQuery, datasource = _a.datasource;
    var serviceOptions = useServices(datasource);
    var theme = useTheme2();
    var _b = useLoadOptions(datasource), onLoadOptions = _b.onLoadOptions, allOptions = _b.allOptions;
    var onSelectTrace = useCallback(function (values, selectedOptions) {
        if (selectedOptions.length === 3) {
            var traceID = selectedOptions[2].value;
            onChange(__assign(__assign({}, query), { query: traceID }));
            onRunQuery();
        }
    }, [onChange, onRunQuery, query]);
    var onChangeQuery = function (value) {
        var nextQuery = __assign(__assign({}, query), { query: value });
        onChange(nextQuery);
    };
    var cascaderOptions = useMapToCascaderOptions(serviceOptions, allOptions);
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Query type" },
                React.createElement(RadioButtonGroup, { options: [
                        { value: 'traceID', label: 'TraceID' },
                        { value: 'upload', label: 'JSON file' },
                    ], value: query.queryType || 'traceID', onChange: function (v) {
                        return onChange(__assign(__assign({}, query), { queryType: v }));
                    }, size: "md" }))),
        query.queryType === 'upload' ? (React.createElement("div", { className: css({ padding: theme.spacing(2) }) },
            React.createElement(FileDropzone, { options: { multiple: false }, onLoad: function (result) {
                    datasource.uploadedJson = result;
                    onRunQuery();
                } }))) : (React.createElement(InlineFieldRow, null,
            React.createElement(ButtonCascader, { options: cascaderOptions, onChange: onSelectTrace, loadData: onLoadOptions }, "Traces"),
            React.createElement("div", { className: "gf-form gf-form--grow flex-shrink-1 min-width-15" },
                React.createElement(QueryField, { query: query.query, onChange: onChangeQuery, onRunQuery: onRunQuery, placeholder: 'Insert Trace ID (run with Shift+Enter)', portalOrigin: "zipkin" }))))));
};
// Exported for tests
export function useServices(datasource) {
    var _this = this;
    var url = apiPrefix + "/services";
    var _a = __read(useAsyncFn(function () { return __awaiter(_this, void 0, void 0, function () {
        var services, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, datasource.metadataRequest(url)];
                case 1:
                    services = _a.sent();
                    if (services) {
                        return [2 /*return*/, services.sort().map(function (service) { return ({
                                label: service,
                                value: service,
                                isLeaf: false,
                            }); })];
                    }
                    return [2 /*return*/, []];
                case 2:
                    error_1 = _a.sent();
                    dispatch(notifyApp(createErrorNotification('Failed to load services from Zipkin', error_1)));
                    throw error_1;
                case 3: return [2 /*return*/];
            }
        });
    }); }, [datasource]), 2), servicesOptions = _a[0], fetch = _a[1];
    useMount(function () {
        // We should probably call this periodically to get new services after mount.
        fetch();
    });
    return servicesOptions;
}
// Exported for tests
export function useLoadOptions(datasource) {
    var isMounted = useMountedState();
    var _a = __read(useState({}), 2), allOptions = _a[0], setAllOptions = _a[1];
    var _b = __read(useAsyncFn(function findSpans(service) {
        return __awaiter(this, void 0, void 0, function () {
            var url, response_1, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = apiPrefix + "/spans";
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, datasource.metadataRequest(url, { serviceName: service })];
                    case 2:
                        response_1 = _a.sent();
                        if (isMounted()) {
                            setAllOptions(function (state) {
                                var _a;
                                var spanOptions = fromPairs(response_1.map(function (span) { return [span, undefined]; }));
                                return __assign(__assign({}, state), (_a = {}, _a[service] = spanOptions, _a));
                            });
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        dispatch(notifyApp(createErrorNotification('Failed to load spans from Zipkin', error_2)));
                        throw error_2;
                    case 4: return [2 /*return*/];
                }
            });
        });
    }, [datasource, allOptions]), 2), fetchSpans = _b[1];
    var _c = __read(useAsyncFn(function findTraces(serviceName, spanName) {
        return __awaiter(this, void 0, void 0, function () {
            var url, search, traces, newTraces_1, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = apiPrefix + "/traces";
                        search = {
                            serviceName: serviceName,
                            spanName: spanName,
                            // See other params and default here https://zipkin.io/zipkin-api/#/default/get_traces
                        };
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, datasource.metadataRequest(url, search)];
                    case 2:
                        traces = _a.sent();
                        if (isMounted()) {
                            newTraces_1 = traces.length
                                ? fromPairs(traces.map(function (trace) {
                                    var rootSpan = trace.find(function (span) { return !span.parentId; });
                                    return [rootSpan.name + " [" + Math.floor(rootSpan.duration / 1000) + " ms]", rootSpan.traceId];
                                }))
                                : noTracesOptions;
                            setAllOptions(function (state) {
                                var _a, _b;
                                var spans = state[serviceName];
                                return __assign(__assign({}, state), (_a = {}, _a[serviceName] = __assign(__assign({}, spans), (_b = {}, _b[spanName] = newTraces_1, _b)), _a));
                            });
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _a.sent();
                        dispatch(notifyApp(createErrorNotification('Failed to load spans from Zipkin', error_3)));
                        throw error_3;
                    case 4: return [2 /*return*/];
                }
            });
        });
    }, [datasource]), 2), fetchTraces = _c[1];
    var onLoadOptions = useCallback(function (selectedOptions) {
        var service = selectedOptions[0].value;
        if (selectedOptions.length === 1) {
            fetchSpans(service);
        }
        else if (selectedOptions.length === 2) {
            var spanName = selectedOptions[1].value;
            fetchTraces(service, spanName);
        }
    }, [fetchSpans, fetchTraces]);
    return {
        onLoadOptions: onLoadOptions,
        allOptions: allOptions,
    };
}
function useMapToCascaderOptions(services, allOptions) {
    return useMemo(function () {
        var cascaderOptions = [];
        if (services.value && services.value.length) {
            cascaderOptions = services.value.map(function (services) {
                return __assign(__assign({}, services), { children: allOptions[services.value] &&
                        Object.keys(allOptions[services.value]).map(function (spanName) {
                            return {
                                label: spanName,
                                value: spanName,
                                isLeaf: false,
                                children: allOptions[services.value][spanName] &&
                                    Object.keys(allOptions[services.value][spanName]).map(function (traceName) {
                                        return {
                                            label: traceName,
                                            value: allOptions[services.value][spanName][traceName],
                                        };
                                    }),
                            };
                        }) });
            });
        }
        else if (services.value && !services.value.length) {
            cascaderOptions = noTracesFoundOptions;
        }
        return cascaderOptions;
    }, [services, allOptions]);
}
var NO_TRACES_KEY = '__NO_TRACES__';
var noTracesFoundOptions = [
    {
        label: 'No traces found',
        value: 'no_traces',
        isLeaf: true,
        // Cannot be disabled because then cascader shows 'loading' for some reason.
        // disabled: true,
    },
];
var noTracesOptions = {
    '[No traces in time range]': NO_TRACES_KEY,
};
//# sourceMappingURL=QueryField.js.map