import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { selectOptionInTest } from '@grafana/ui';
import MetricsQueryEditor from './MetricsQueryEditor';
import createMockQuery from '../../__mocks__/query';
import createMockDatasource from '../../__mocks__/datasource';
var variableOptionGroup = {
    label: 'Template variables',
    options: [],
};
describe('Azure Monitor QueryEditor', function () {
    it('should render', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockDatasource;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockDatasource = createMockDatasource();
                    render(React.createElement(MetricsQueryEditor, { subscriptionId: "123", query: createMockQuery(), datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: function () { }, setError: function () { } }));
                    return [4 /*yield*/, waitFor(function () { return expect(screen.getByTestId('azure-monitor-metrics-query-editor')).toBeInTheDocument(); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should change the subscription ID when selected', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockDatasource, onChange, mockQuery, subscriptions;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockDatasource = createMockDatasource();
                    onChange = jest.fn();
                    mockQuery = createMockQuery();
                    ((_a = mockQuery.azureMonitor) !== null && _a !== void 0 ? _a : {}).metricName = undefined;
                    mockDatasource.azureMonitorDatasource.getSubscriptions = jest.fn().mockResolvedValueOnce([
                        {
                            value: 'abc-123',
                            text: 'Primary Subscription',
                        },
                        {
                            value: 'abc-456',
                            text: 'Another Subscription',
                        },
                    ]);
                    render(React.createElement(MetricsQueryEditor, { subscriptionId: "123", query: mockQuery, datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: function () { } }));
                    return [4 /*yield*/, screen.findByLabelText('Subscription')];
                case 1:
                    subscriptions = _b.sent();
                    return [4 /*yield*/, selectOptionInTest(subscriptions, 'Another Subscription')];
                case 2:
                    _b.sent();
                    expect(onChange).toHaveBeenCalledWith(__assign(__assign({}, mockQuery), { subscription: 'abc-456', azureMonitor: __assign(__assign({}, mockQuery.azureMonitor), { resourceGroup: undefined, metricDefinition: undefined, metricNamespace: undefined, resourceName: undefined, metricName: undefined, aggregation: undefined, timeGrain: '', dimensionFilters: [] }) }));
                    return [2 /*return*/];
            }
        });
    }); });
    it('should change the metric name when selected', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockDatasource, onChange, mockQuery, metrics;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockDatasource = createMockDatasource();
                    onChange = jest.fn();
                    mockQuery = createMockQuery();
                    mockDatasource.getMetricNames = jest.fn().mockResolvedValue([
                        {
                            value: 'metric-a',
                            text: 'Metric A',
                        },
                        {
                            value: 'metric-b',
                            text: 'Metric B',
                        },
                    ]);
                    render(React.createElement(MetricsQueryEditor, { subscriptionId: "123", query: createMockQuery(), datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: function () { } }));
                    return [4 /*yield*/, waitFor(function () { return expect(screen.getByTestId('azure-monitor-metrics-query-editor')).toBeInTheDocument(); })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, screen.findByLabelText('Metric')];
                case 2:
                    metrics = _a.sent();
                    return [4 /*yield*/, selectOptionInTest(metrics, 'Metric B')];
                case 3:
                    _a.sent();
                    expect(onChange).toHaveBeenLastCalledWith(__assign(__assign({}, mockQuery), { azureMonitor: __assign(__assign({}, mockQuery.azureMonitor), { metricName: 'metric-b' }) }));
                    return [2 /*return*/];
            }
        });
    }); });
    it('should auto select a default aggregation if none exists once a metric is selected', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockDatasource, onChange, mockQuery, metrics;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockDatasource = createMockDatasource();
                    onChange = jest.fn();
                    mockQuery = createMockQuery();
                    ((_a = mockQuery.azureMonitor) !== null && _a !== void 0 ? _a : {}).aggregation = undefined;
                    mockDatasource.getMetricNames = jest.fn().mockResolvedValue([
                        {
                            value: 'metric-a',
                            text: 'Metric A',
                        },
                        {
                            value: 'metric-b',
                            text: 'Metric B',
                        },
                    ]);
                    render(React.createElement(MetricsQueryEditor, { subscriptionId: "123", query: createMockQuery(), datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: function () { } }));
                    return [4 /*yield*/, waitFor(function () { return expect(screen.getByTestId('azure-monitor-metrics-query-editor')).toBeInTheDocument(); })];
                case 1:
                    _b.sent();
                    return [4 /*yield*/, screen.findByLabelText('Metric')];
                case 2:
                    metrics = _b.sent();
                    return [4 /*yield*/, selectOptionInTest(metrics, 'Metric B')];
                case 3:
                    _b.sent();
                    expect(onChange).toHaveBeenLastCalledWith(__assign(__assign({}, mockQuery), { azureMonitor: __assign(__assign({}, mockQuery.azureMonitor), { metricName: 'metric-b', aggregation: 'Average' }) }));
                    return [2 /*return*/];
            }
        });
    }); });
    it('should change the aggregation type when selected', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockDatasource, onChange, mockQuery, aggregation;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockDatasource = createMockDatasource();
                    onChange = jest.fn();
                    mockQuery = createMockQuery();
                    render(React.createElement(MetricsQueryEditor, { subscriptionId: "123", query: createMockQuery(), datasource: mockDatasource, variableOptionGroup: variableOptionGroup, onChange: onChange, setError: function () { } }));
                    return [4 /*yield*/, waitFor(function () { return expect(screen.getByTestId('azure-monitor-metrics-query-editor')).toBeInTheDocument(); })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, screen.findByLabelText('Aggregation')];
                case 2:
                    aggregation = _a.sent();
                    return [4 /*yield*/, selectOptionInTest(aggregation, 'Maximum')];
                case 3:
                    _a.sent();
                    expect(onChange).toHaveBeenLastCalledWith(__assign(__assign({}, mockQuery), { azureMonitor: __assign(__assign({}, mockQuery.azureMonitor), { aggregation: 'Maximum' }) }));
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=MetricsQueryEditor.test.js.map