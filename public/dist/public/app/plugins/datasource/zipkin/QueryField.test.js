import { __awaiter } from "tslib";
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ZipkinQueryField, useLoadOptions, useServices } from './QueryField';
describe('QueryField', () => {
    it('renders properly', () => __awaiter(void 0, void 0, void 0, function* () {
        const ds = {};
        render(React.createElement(ZipkinQueryField, { history: [], datasource: ds, query: { query: '1234', queryType: 'traceID' }, onRunQuery: () => { }, onChange: () => { } }));
        expect(yield screen.findByText(/1234/i)).toBeInTheDocument();
        expect(yield screen.findByText(/Traces/i)).toBeInTheDocument();
    }));
});
describe('useServices', () => {
    it('returns services from datasource', () => __awaiter(void 0, void 0, void 0, function* () {
        const ds = {
            metadataRequest(url) {
                return __awaiter(this, void 0, void 0, function* () {
                    if (url === '/api/v2/services') {
                        return Promise.resolve(['service1', 'service2']);
                    }
                    return undefined;
                });
            },
        };
        const { result } = renderHook(() => useServices(ds));
        yield waitFor(() => {
            expect(result.current.value).toEqual([
                { label: 'service1', value: 'service1', isLeaf: false },
                { label: 'service2', value: 'service2', isLeaf: false },
            ]);
        });
    }));
});
describe('useLoadOptions', () => {
    it('loads spans and traces', () => __awaiter(void 0, void 0, void 0, function* () {
        const ds = {
            metadataRequest(url, params) {
                return __awaiter(this, void 0, void 0, function* () {
                    if (url === '/api/v2/spans' && (params === null || params === void 0 ? void 0 : params.serviceName) === 'service1') {
                        return Promise.resolve(['span1', 'span2']);
                    }
                    if (url === '/api/v2/traces' && (params === null || params === void 0 ? void 0 : params.serviceName) === 'service1' && (params === null || params === void 0 ? void 0 : params.spanName) === 'span1') {
                        return Promise.resolve([[{ name: 'trace1', duration: 10000, traceId: 'traceId1' }]]);
                    }
                    return undefined;
                });
            },
        };
        const { result } = renderHook(() => useLoadOptions(ds));
        expect(result.current.allOptions).toEqual({});
        act(() => {
            result.current.onLoadOptions([{ value: 'service1' }]);
        });
        yield waitFor(() => {
            expect(result.current.allOptions).toEqual({ service1: { span1: undefined, span2: undefined } });
        });
        act(() => {
            result.current.onLoadOptions([{ value: 'service1' }, { value: 'span1' }]);
        });
        yield waitFor(() => {
            expect(result.current.allOptions).toEqual({
                service1: { span1: { 'trace1 [10 ms]': 'traceId1' }, span2: undefined },
            });
        });
    }));
});
//# sourceMappingURL=QueryField.test.js.map