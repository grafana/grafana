import { __awaiter, __generator } from "tslib";
import { act, renderHook } from '@testing-library/react-hooks';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ZipkinQueryField, useLoadOptions, useServices } from './QueryField';
describe('QueryField', function () {
    it('renders properly', function () {
        var ds = {};
        render(React.createElement(ZipkinQueryField, { history: [], datasource: ds, query: { query: '1234' }, onRunQuery: function () { }, onChange: function () { } }));
        expect(screen.getByText(/1234/i)).toBeInTheDocument();
        expect(screen.getByText(/Traces/i)).toBeInTheDocument();
    });
});
describe('useServices', function () {
    it('returns services from datasource', function () { return __awaiter(void 0, void 0, void 0, function () {
        var ds, _a, result, waitForNextUpdate;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    ds = {
                        metadataRequest: function (url, params) {
                            return __awaiter(this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    if (url === '/api/v2/services') {
                                        return [2 /*return*/, Promise.resolve(['service1', 'service2'])];
                                    }
                                    return [2 /*return*/];
                                });
                            });
                        },
                    };
                    _a = renderHook(function () { return useServices(ds); }), result = _a.result, waitForNextUpdate = _a.waitForNextUpdate;
                    return [4 /*yield*/, waitForNextUpdate()];
                case 1:
                    _b.sent();
                    expect(result.current.value).toEqual([
                        { label: 'service1', value: 'service1', isLeaf: false },
                        { label: 'service2', value: 'service2', isLeaf: false },
                    ]);
                    return [2 /*return*/];
            }
        });
    }); });
});
describe('useLoadOptions', function () {
    it('loads spans and traces', function () { return __awaiter(void 0, void 0, void 0, function () {
        var ds, _a, result, waitForNextUpdate;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    ds = {
                        metadataRequest: function (url, params) {
                            return __awaiter(this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    if (url === '/api/v2/spans' && (params === null || params === void 0 ? void 0 : params.serviceName) === 'service1') {
                                        return [2 /*return*/, Promise.resolve(['span1', 'span2'])];
                                    }
                                    if (url === '/api/v2/traces' && (params === null || params === void 0 ? void 0 : params.serviceName) === 'service1' && (params === null || params === void 0 ? void 0 : params.spanName) === 'span1') {
                                        return [2 /*return*/, Promise.resolve([[{ name: 'trace1', duration: 10000, traceId: 'traceId1' }]])];
                                    }
                                    return [2 /*return*/];
                                });
                            });
                        },
                    };
                    _a = renderHook(function () { return useLoadOptions(ds); }), result = _a.result, waitForNextUpdate = _a.waitForNextUpdate;
                    expect(result.current.allOptions).toEqual({});
                    act(function () {
                        result.current.onLoadOptions([{ value: 'service1' }]);
                    });
                    return [4 /*yield*/, waitForNextUpdate()];
                case 1:
                    _b.sent();
                    expect(result.current.allOptions).toEqual({ service1: { span1: undefined, span2: undefined } });
                    act(function () {
                        result.current.onLoadOptions([{ value: 'service1' }, { value: 'span1' }]);
                    });
                    return [4 /*yield*/, waitForNextUpdate()];
                case 2:
                    _b.sent();
                    expect(result.current.allOptions).toEqual({
                        service1: { span1: { 'trace1 [10 ms]': 'traceId1' }, span2: undefined },
                    });
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=QueryField.test.js.map