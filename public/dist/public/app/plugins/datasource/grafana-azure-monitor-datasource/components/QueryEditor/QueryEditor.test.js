import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import selectEvent from 'react-select-event';
import QueryEditor from './QueryEditor';
import createMockQuery from '../../__mocks__/query';
import createMockDatasource from '../../__mocks__/datasource';
import { AzureQueryType } from '../../types';
import { invalidNamespaceError } from '../../__mocks__/errors';
import * as ui from '@grafana/ui';
// Have to mock CodeEditor because it doesnt seem to work in tests???
jest.mock('@grafana/ui', function () { return (__assign(__assign({}, jest.requireActual('@grafana/ui')), { CodeEditor: function CodeEditor(_a) {
        var value = _a.value;
        return React.createElement("pre", null, value);
    } })); });
describe('Azure Monitor QueryEditor', function () {
    it('renders the Metrics query editor when the query type is Metrics', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockDatasource, mockQuery;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockDatasource = createMockDatasource();
                    mockQuery = __assign(__assign({}, createMockQuery()), { queryType: AzureQueryType.AzureMonitor });
                    render(React.createElement(QueryEditor, { query: mockQuery, datasource: mockDatasource, onChange: function () { }, onRunQuery: function () { } }));
                    return [4 /*yield*/, waitFor(function () { return expect(screen.getByTestId('azure-monitor-metrics-query-editor')).toBeInTheDocument(); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('renders the Logs query editor when the query type is Logs', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockDatasource, mockQuery;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockDatasource = createMockDatasource();
                    mockQuery = __assign(__assign({}, createMockQuery()), { queryType: AzureQueryType.LogAnalytics });
                    render(React.createElement(QueryEditor, { query: mockQuery, datasource: mockDatasource, onChange: function () { }, onRunQuery: function () { } }));
                    return [4 /*yield*/, waitFor(function () { return expect(screen.queryByTestId('azure-monitor-logs-query-editor')).toBeInTheDocument(); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('renders the ApplicationInsights query editor when the query type is Application Insights and renders values in disabled inputs', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockDatasource, mockQuery, metricInput;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockDatasource = createMockDatasource();
                    mockQuery = __assign(__assign({}, createMockQuery()), { queryType: AzureQueryType.ApplicationInsights, appInsights: {
                            metricName: 'requests/count',
                            timeGrain: 'PT1H',
                            timeGrainCount: '1',
                            timeGrainType: 'specific',
                            timeGrainUnit: 'hour',
                            aggregation: 'average',
                            dimension: ['request/name'],
                            dimensionFilter: "request/name eq 'GET Home/Index'",
                            alias: '{{ request/name }}',
                        } });
                    render(React.createElement(QueryEditor, { query: mockQuery, datasource: mockDatasource, onChange: function () { }, onRunQuery: function () { } }));
                    return [4 /*yield*/, waitFor(function () {
                            return expect(screen.queryByTestId('azure-monitor-application-insights-query-editor')).toBeInTheDocument();
                        })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, screen.getByLabelText('Metric')];
                case 2:
                    metricInput = _a.sent();
                    expect(metricInput).toBeDisabled();
                    expect(metricInput).toHaveValue('requests/count');
                    return [2 /*return*/];
            }
        });
    }); });
    it('changes the query type when selected', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockDatasource, mockQuery, onChange, metrics;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockDatasource = createMockDatasource();
                    mockQuery = createMockQuery();
                    onChange = jest.fn();
                    render(React.createElement(QueryEditor, { query: mockQuery, datasource: mockDatasource, onChange: onChange, onRunQuery: function () { } }));
                    return [4 /*yield*/, waitFor(function () { return expect(screen.getByTestId('azure-monitor-query-editor')).toBeInTheDocument(); })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, screen.findByLabelText('Service')];
                case 2:
                    metrics = _a.sent();
                    return [4 /*yield*/, ui.selectOptionInTest(metrics, 'Logs')];
                case 3:
                    _a.sent();
                    expect(onChange).toHaveBeenCalledWith(__assign(__assign({}, mockQuery), { queryType: AzureQueryType.LogAnalytics }));
                    return [2 /*return*/];
            }
        });
    }); });
    it('displays error messages from frontend Azure calls', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockDatasource;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockDatasource = createMockDatasource();
                    mockDatasource.azureMonitorDatasource.getSubscriptions = jest.fn().mockRejectedValue(invalidNamespaceError());
                    render(React.createElement(QueryEditor, { query: createMockQuery(), datasource: mockDatasource, onChange: function () { }, onRunQuery: function () { } }));
                    return [4 /*yield*/, waitFor(function () { return expect(screen.getByTestId('azure-monitor-query-editor')).toBeInTheDocument(); })];
                case 1:
                    _a.sent();
                    expect(screen.getByText("The resource namespace 'grafanadev' is invalid.")).toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    it('hides deprecated services', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockDatasource, mockQuery, metrics;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockDatasource = createMockDatasource();
                    mockQuery = __assign(__assign({}, createMockQuery()), { queryType: AzureQueryType.AzureMonitor });
                    render(React.createElement(QueryEditor, { query: mockQuery, datasource: mockDatasource, onChange: function () { }, onRunQuery: function () { } }));
                    return [4 /*yield*/, waitFor(function () { return expect(screen.getByTestId('azure-monitor-metrics-query-editor')).toBeInTheDocument(); })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, screen.findByLabelText('Service')];
                case 2:
                    metrics = _a.sent();
                    selectEvent.openMenu(metrics);
                    expect(screen.queryByText('Application Insights')).not.toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    it("shows deprecated services when they're selected", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockDatasource, mockQuery, metrics;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockDatasource = createMockDatasource();
                    mockQuery = __assign(__assign({}, createMockQuery()), { queryType: AzureQueryType.ApplicationInsights });
                    render(React.createElement(QueryEditor, { query: mockQuery, datasource: mockDatasource, onChange: function () { }, onRunQuery: function () { } }));
                    return [4 /*yield*/, waitFor(function () {
                            return expect(screen.getByTestId('azure-monitor-application-insights-query-editor')).toBeInTheDocument();
                        })];
                case 1:
                    _a.sent();
                    expect(screen.queryByText('Application Insights')).toBeInTheDocument();
                    return [4 /*yield*/, screen.findByLabelText('Service')];
                case 2:
                    metrics = _a.sent();
                    return [4 /*yield*/, ui.selectOptionInTest(metrics, 'Logs')];
                case 3:
                    _a.sent();
                    expect(screen.queryByText('Application Insights')).toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=QueryEditor.test.js.map