import { __awaiter } from "tslib";
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import selectEvent from 'react-select-event';
import { config } from '@grafana/runtime';
import { setupMockedDataSource, statisticVariable } from '../../../__mocks__/CloudWatchDataSource';
import { validMetricSearchBuilderQuery } from '../../../__mocks__/queries';
import { MetricStatEditor } from './MetricStatEditor';
const originalFeatureToggleValue = config.featureToggles.cloudWatchCrossAccountQuerying;
const ds = setupMockedDataSource({
    variables: [statisticVariable],
});
ds.datasource.resources.getNamespaces = jest.fn().mockResolvedValue([]);
ds.datasource.resources.getMetrics = jest.fn().mockResolvedValue([]);
ds.datasource.resources.getDimensionKeys = jest.fn().mockResolvedValue([]);
ds.datasource.getVariables = jest.fn().mockReturnValue([]);
const metricStat = {
    region: 'us-east-2',
    namespace: '',
    metricName: '',
    dimensions: {},
    statistic: '',
    matchExact: true,
};
const props = {
    refId: 'A',
    datasource: ds.datasource,
    metricStat,
    onChange: jest.fn(),
};
describe('MetricStatEditor', () => {
    afterEach(() => {
        config.featureToggles.cloudWatchCrossAccountQuerying = originalFeatureToggleValue;
    });
    describe('statistics field', () => {
        test.each(['Average', 'p23.23', 'p34', '$statistic'])('should accept valid values', (statistic) => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            render(React.createElement(MetricStatEditor, Object.assign({}, props, { onChange: onChange })));
            const statisticElement = yield screen.findByLabelText('Statistic');
            expect(statisticElement).toBeInTheDocument();
            yield userEvent.type(statisticElement, statistic);
            fireEvent.keyDown(statisticElement, { keyCode: 13 });
            expect(onChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, props.metricStat), { statistic }));
        }));
        test.each(['CustomStat', 'p23,23', 'tc(80%:)', 'ts', 'wm', 'pr', 'tm', 'tm(10:90)', '$someUnknownValue'])('should not accept invalid values', (statistic) => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            render(React.createElement(MetricStatEditor, Object.assign({}, props, { onChange: onChange })));
            const statisticElement = yield screen.findByLabelText('Statistic');
            expect(statisticElement).toBeInTheDocument();
            yield userEvent.type(statisticElement, statistic);
            fireEvent.keyDown(statisticElement, { keyCode: 13 });
            expect(onChange).not.toHaveBeenCalled();
        }));
        test.each([
            'IQM',
            'tm90',
            'tm23.23',
            'TM(25%:75%)',
            'TM(0.005:0.030)',
            'TM(150:1000)',
            'TM(:0.5)',
            'TM(:95%)',
            'wm98',
            'wm23.23',
            'WM(25%:75%)',
            'WM(0.005:0.030)',
            'WM(150:1000)',
            'WM(:0.5)',
            'PR(10:)',
            'PR(:300)',
            'PR(100:20000)',
            'tc90',
            'tc23.23',
            'TC(0.005:0.030)',
            'TC(:0.5)',
            'TC(25%:75%)',
            'TC(150:1000)',
            'TC(:0.5)',
            'ts90',
            'ts23.23',
            'TS(80%:)',
        ])('should accept other valid statistics syntax', (statistic) => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            render(React.createElement(MetricStatEditor, Object.assign({}, props, { onChange: onChange })));
            const statisticElement = yield screen.findByLabelText('Statistic');
            expect(statisticElement).toBeInTheDocument();
            yield userEvent.type(statisticElement, statistic);
            fireEvent.keyDown(statisticElement, { keyCode: 13 });
            expect(onChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, props.metricStat), { statistic }));
        }));
    });
    describe('expressions', () => {
        it('should display match exact switch is not set', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(MetricStatEditor, Object.assign({}, props)));
            expect(yield screen.findByText('Match exact')).toBeInTheDocument();
        }));
        it('should display match exact switch if prop is set to false', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(MetricStatEditor, Object.assign({}, props, { disableExpressions: false })));
            expect(yield screen.findByText('Match exact')).toBeInTheDocument();
        }));
        it('should not display match exact switch if prop is set to true', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(MetricStatEditor, Object.assign({}, props, { disableExpressions: true })));
            yield waitFor(() => {
                expect(screen.queryByText('Match exact')).toBeNull();
            });
        }));
    });
    describe('match exact', () => {
        it('should be checked when value is true', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(MetricStatEditor, Object.assign({}, props, { disableExpressions: false })));
            expect(yield screen.findByLabelText('Match exact - optional')).toBeChecked();
        }));
        it('should be unchecked when value is false', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(MetricStatEditor, Object.assign({}, props, { metricStat: Object.assign(Object.assign({}, props.metricStat), { matchExact: false }), disableExpressions: false })));
            expect(yield screen.findByLabelText('Match exact - optional')).not.toBeChecked();
        }));
    });
    describe('validating Query namespace / metricName', () => {
        const namespaces = [
            { value: 'n1', label: 'n1', text: 'n1' },
            { value: 'n2', label: 'n2', text: 'n2' },
        ];
        const metrics = [
            { value: 'm1', label: 'm1', text: 'm1' },
            { value: 'm2', label: 'm2', text: 'm2' },
        ];
        const onChange = jest.fn();
        const propsNamespaceMetrics = Object.assign(Object.assign({}, props), { onChange });
        beforeEach(() => {
            propsNamespaceMetrics.datasource.resources.getNamespaces = jest.fn().mockResolvedValue(namespaces);
            propsNamespaceMetrics.datasource.resources.getMetrics = jest.fn().mockResolvedValue(metrics);
            onChange.mockClear();
        });
        it('should select namespace and metric name correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            yield act(() => __awaiter(void 0, void 0, void 0, function* () {
                render(React.createElement(MetricStatEditor, Object.assign({}, propsNamespaceMetrics)));
            }));
            const namespaceSelect = screen.getByLabelText('Namespace');
            const metricsSelect = screen.getByLabelText('Metric name');
            expect(namespaceSelect).toBeInTheDocument();
            expect(metricsSelect).toBeInTheDocument();
            yield selectEvent.select(namespaceSelect, 'n1', { container: document.body });
            yield selectEvent.select(metricsSelect, 'm1', { container: document.body });
            expect(onChange.mock.calls).toEqual([
                [Object.assign(Object.assign({}, propsNamespaceMetrics.metricStat), { namespace: 'n1' })],
                [Object.assign(Object.assign({}, propsNamespaceMetrics.metricStat), { metricName: 'm1' })], // Second call, metric select
            ]);
        }));
        it('should remove metricName from metricStat if it does not exist in new namespace', () => __awaiter(void 0, void 0, void 0, function* () {
            propsNamespaceMetrics.datasource.resources.getMetrics = jest.fn().mockImplementation(({ namespace, region }) => {
                let mockMetrics = namespace === 'n1' && region === props.metricStat.region
                    ? metrics
                    : [{ value: 'oldNamespaceMetric', label: 'oldNamespaceMetric', text: 'oldNamespaceMetric' }];
                return Promise.resolve(mockMetrics);
            });
            propsNamespaceMetrics.metricStat.metricName = 'oldNamespaceMetric';
            propsNamespaceMetrics.metricStat.namespace = 'n2';
            yield act(() => __awaiter(void 0, void 0, void 0, function* () {
                render(React.createElement(MetricStatEditor, Object.assign({}, propsNamespaceMetrics)));
            }));
            const namespaceSelect = screen.getByLabelText('Namespace');
            expect(screen.getByText('n2')).toBeInTheDocument();
            expect(screen.getByText('oldNamespaceMetric')).toBeInTheDocument();
            yield waitFor(() => selectEvent.select(namespaceSelect, 'n1', { container: document.body }));
            expect(onChange.mock.calls).toEqual([[Object.assign(Object.assign({}, propsNamespaceMetrics.metricStat), { metricName: '', namespace: 'n1' })]]);
        }));
        it('should not remove metricName from metricStat if it does exist in new namespace', () => __awaiter(void 0, void 0, void 0, function* () {
            propsNamespaceMetrics.metricStat.namespace = 'n1';
            propsNamespaceMetrics.metricStat.metricName = 'm1';
            yield act(() => __awaiter(void 0, void 0, void 0, function* () {
                render(React.createElement(MetricStatEditor, Object.assign({}, propsNamespaceMetrics)));
            }));
            const namespaceSelect = screen.getByLabelText('Namespace');
            expect(screen.getByText('n1')).toBeInTheDocument();
            expect(screen.getByText('m1')).toBeInTheDocument();
            yield waitFor(() => selectEvent.select(namespaceSelect, 'n2', { container: document.body }));
            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange.mock.calls).toEqual([
                [Object.assign(Object.assign({}, propsNamespaceMetrics.metricStat), { metricName: 'm1', namespace: 'n2' })],
            ]);
        }));
    });
    describe('metric value', () => {
        it('should be displayed when a custom value is used and its value is not in the select options', () => __awaiter(void 0, void 0, void 0, function* () {
            const expected = 'CPUUtilzation';
            yield act(() => __awaiter(void 0, void 0, void 0, function* () {
                render(React.createElement(MetricStatEditor, Object.assign({}, props, { metricStat: Object.assign(Object.assign({}, props.metricStat), { metricName: expected }) })));
            }));
            expect(yield screen.findByText(expected)).toBeInTheDocument();
        }));
    });
    describe('account id', () => {
        it('should set value to "all" when its a monitoring account and no account id is defined in the query', () => __awaiter(void 0, void 0, void 0, function* () {
            config.featureToggles.cloudWatchCrossAccountQuerying = true;
            const onChange = jest.fn();
            props.datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(true);
            props.datasource.resources.getAccounts = jest.fn().mockResolvedValue([
                {
                    value: '123456789',
                    label: 'test-account1',
                    description: '123456789',
                },
                {
                    value: '432156789013',
                    label: 'test-account2',
                    description: '432156789013',
                },
            ]);
            yield act(() => __awaiter(void 0, void 0, void 0, function* () {
                render(React.createElement(MetricStatEditor, Object.assign({}, props, { metricStat: Object.assign(Object.assign({}, validMetricSearchBuilderQuery), { accountId: undefined }), onChange: onChange })));
            }));
            expect(onChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, validMetricSearchBuilderQuery), { accountId: 'all' }));
            expect(yield screen.findByText('Account')).toBeInTheDocument();
        }));
        it('should unset value when no accounts were found and an account id is defined in the query', () => __awaiter(void 0, void 0, void 0, function* () {
            config.featureToggles.cloudWatchCrossAccountQuerying = true;
            const onChange = jest.fn();
            props.datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(false);
            props.datasource.resources.getAccounts = jest.fn().mockResolvedValue([]);
            yield act(() => __awaiter(void 0, void 0, void 0, function* () {
                render(React.createElement(MetricStatEditor, Object.assign({}, props, { metricStat: Object.assign(Object.assign({}, validMetricSearchBuilderQuery), { accountId: '123456789' }), onChange: onChange })));
            }));
            expect(onChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, validMetricSearchBuilderQuery), { accountId: undefined }));
            expect(yield screen.queryByText('Account')).not.toBeInTheDocument();
        }));
    });
});
//# sourceMappingURL=MetricStatEditor.test.js.map