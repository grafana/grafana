import { __awaiter, __generator } from "tslib";
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ElasticsearchProvider } from '../ElasticsearchQueryContext';
import { MetricEditor } from './MetricEditor';
import React from 'react';
import { getDefaultTimeRange } from '@grafana/data';
import { defaultBucketAgg, defaultMetricAgg } from '../../../query_def';
import { from } from 'rxjs';
describe('Metric Editor', function () {
    it('Should display a "None" option for "field" if the metric supports inline script', function () { return __awaiter(void 0, void 0, void 0, function () {
        var avg, query, getFields, wrapper, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    avg = {
                        id: '1',
                        type: 'avg',
                    };
                    query = {
                        refId: 'A',
                        query: '',
                        metrics: [avg],
                        bucketAggs: [defaultBucketAgg('2')],
                    };
                    getFields = jest.fn(function () { return from([[]]); });
                    wrapper = function (_a) {
                        var children = _a.children;
                        return (React.createElement(ElasticsearchProvider, { datasource: { getFields: getFields }, query: query, range: getDefaultTimeRange(), onChange: function () { }, onRunQuery: function () { } }, children));
                    };
                    render(React.createElement(MetricEditor, { value: avg }), { wrapper: wrapper });
                    act(function () {
                        fireEvent.click(screen.getByText('Select Field'));
                    });
                    _a = expect;
                    return [4 /*yield*/, screen.findByText('None')];
                case 1:
                    _a.apply(void 0, [_b.sent()]).toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    it('Should not display a "None" option for "field" if the metric does not support inline script', function () { return __awaiter(void 0, void 0, void 0, function () {
        var avg, query, getFields, wrapper, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    avg = {
                        id: '1',
                        type: 'cardinality',
                    };
                    query = {
                        refId: 'A',
                        query: '',
                        metrics: [avg],
                        bucketAggs: [defaultBucketAgg('2')],
                    };
                    getFields = jest.fn(function () { return from([[]]); });
                    wrapper = function (_a) {
                        var children = _a.children;
                        return (React.createElement(ElasticsearchProvider, { datasource: { getFields: getFields }, query: query, range: getDefaultTimeRange(), onChange: function () { }, onRunQuery: function () { } }, children));
                    };
                    render(React.createElement(MetricEditor, { value: avg }), { wrapper: wrapper });
                    act(function () {
                        fireEvent.click(screen.getByText('Select Field'));
                    });
                    _a = expect;
                    return [4 /*yield*/, screen.findByText('No options found')];
                case 1:
                    _a.apply(void 0, [_b.sent()]).toBeInTheDocument();
                    expect(screen.queryByText('None')).not.toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    describe('Top Metrics Aggregation', function () {
        var setupTopMetricsScreen = function (esVersion, xpack) {
            var query = {
                refId: 'A',
                query: '',
                metrics: [defaultMetricAgg('1')],
                bucketAggs: [defaultBucketAgg('2')],
            };
            var getFields = jest.fn(function () { return from([[]]); });
            var wrapper = function (_a) {
                var children = _a.children;
                return (React.createElement(ElasticsearchProvider, { datasource: { getFields: getFields, esVersion: esVersion, xpack: xpack }, query: query, range: getDefaultTimeRange(), onChange: function () { }, onRunQuery: function () { } }, children));
            };
            render(React.createElement(MetricEditor, { value: defaultMetricAgg('1') }), { wrapper: wrapper });
            act(function () {
                fireEvent.click(screen.getByText('Count'));
            });
        };
        it('Should include top metrics aggregation when esVersion is 77 and X-Pack is enabled', function () {
            setupTopMetricsScreen('7.7.0', true);
            expect(screen.getByText('Top Metrics')).toBeInTheDocument();
        });
        it('Should NOT include top metrics aggregation where esVersion is 77 and X-Pack is disabled', function () {
            setupTopMetricsScreen('7.7.0', false);
            expect(screen.queryByText('Top Metrics')).toBe(null);
        });
        it('Should NOT include top metrics aggregation when esVersion is 70 and X-Pack is enabled', function () {
            setupTopMetricsScreen('7.0.0', true);
            expect(screen.queryByText('Top Metrics')).toBe(null);
        });
    });
});
//# sourceMappingURL=MetricEditor.test.js.map