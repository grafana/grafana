import { __awaiter } from "tslib";
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { openMenu, select } from 'react-select-event';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { createMockDatasource } from '../__mocks__/cloudMonitoringDatasource';
import { createMockMetricDescriptor } from '../__mocks__/cloudMonitoringMetricDescriptor';
import { createMockTimeSeriesList } from '../__mocks__/cloudMonitoringQuery';
import { PreprocessorType, MetricKind } from '../types/query';
import { defaultTimeSeriesList } from './MetricQueryEditor';
import { VisualMetricQueryEditor } from './VisualMetricQueryEditor';
const defaultProps = {
    refId: 'refId',
    customMetaData: {},
    variableOptionGroup: { options: [] },
    aliasBy: '',
    onChangeAliasBy: jest.fn(),
};
describe('VisualMetricQueryEditor', () => {
    it('renders metrics fields', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        const query = createMockTimeSeriesList();
        const datasource = createMockDatasource();
        render(React.createElement(VisualMetricQueryEditor, Object.assign({}, defaultProps, { onChange: onChange, datasource: datasource, query: query })));
        expect(yield screen.findByLabelText('Service')).toBeInTheDocument();
        expect(yield screen.findByLabelText('Metric name')).toBeInTheDocument();
    }));
    it('can select a service', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        const query = createMockTimeSeriesList();
        const mockMetricDescriptor = createMockMetricDescriptor();
        const datasource = createMockDatasource({
            getMetricTypes: jest.fn().mockResolvedValue([mockMetricDescriptor]),
            getLabels: jest.fn().mockResolvedValue([]),
        });
        render(React.createElement(VisualMetricQueryEditor, Object.assign({}, defaultProps, { onChange: onChange, datasource: datasource, query: query })));
        const service = yield screen.findByLabelText('Service');
        openMenu(service);
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            yield select(service, 'Srv', { container: document.body });
        }));
        expect(onChange).toBeCalledWith(expect.objectContaining({ filters: ['metric.type', '=', mockMetricDescriptor.type] }));
    }));
    it('can select a metric name', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        const query = createMockTimeSeriesList();
        const mockMetricDescriptor = createMockMetricDescriptor({ displayName: 'metricName_test', type: 'test_type' });
        const datasource = createMockDatasource({
            getMetricTypes: jest.fn().mockResolvedValue([createMockMetricDescriptor(), mockMetricDescriptor]),
            filterMetricsByType: jest.fn().mockResolvedValue([createMockMetricDescriptor(), mockMetricDescriptor]),
            getLabels: jest.fn().mockResolvedValue([]),
        });
        render(React.createElement(VisualMetricQueryEditor, Object.assign({}, defaultProps, { onChange: onChange, datasource: datasource, query: query })));
        const service = yield screen.findByLabelText('Service');
        openMenu(service);
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            yield select(service, 'Srv', { container: document.body });
        }));
        const metricName = yield screen.findByLabelText('Metric name');
        openMenu(metricName);
        yield userEvent.type(metricName, 'test');
        yield waitFor(() => expect(document.body).toHaveTextContent('metricName_test'));
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            yield select(metricName, 'metricName_test', { container: document.body });
        }));
        expect(onChange).toBeCalledWith(expect.objectContaining({ filters: ['metric.type', '=', mockMetricDescriptor.type] }));
    }));
    it('should have a distinct list of services', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        const datasource = createMockDatasource({
            getMetricTypes: jest.fn().mockResolvedValue([
                createMockMetricDescriptor({
                    service: 'service_a',
                    serviceShortName: 'srv_a',
                    type: 'metric1',
                    description: 'description_metric1',
                    displayName: 'displayName_metric1',
                }),
                createMockMetricDescriptor({
                    service: 'service_b',
                    serviceShortName: 'srv_b',
                    type: 'metric2',
                    description: 'description_metric2',
                    displayName: 'displayName_metric2',
                }),
                createMockMetricDescriptor({
                    service: 'service_b',
                    serviceShortName: 'srv_b',
                    type: 'metric3',
                    description: 'description_metric3',
                    displayName: 'displayName_metric3',
                }),
            ]),
        });
        const query = createMockTimeSeriesList();
        render(React.createElement(VisualMetricQueryEditor, Object.assign({}, defaultProps, { onChange: onChange, datasource: datasource, query: query })));
        const service = yield screen.findByLabelText('Service');
        openMenu(service);
        expect(screen.getAllByLabelText('Select option').length).toEqual(2);
    }));
    it('resets query to default when service changes', () => __awaiter(void 0, void 0, void 0, function* () {
        const query = createMockTimeSeriesList({ filters: ['metric.test_label', '=', 'test', 'AND'] });
        const onChange = jest.fn();
        const datasource = createMockDatasource({
            getMetricTypes: jest
                .fn()
                .mockResolvedValue([
                createMockMetricDescriptor(),
                createMockMetricDescriptor({ type: 'type2', service: 'service2', serviceShortName: 'srv2' }),
            ]),
            getLabels: jest.fn().mockResolvedValue([]),
        });
        const defaultQuery = Object.assign(Object.assign(Object.assign({}, query), defaultTimeSeriesList(datasource)), { filters: ['metric.type', '=', 'type2'] });
        render(React.createElement(VisualMetricQueryEditor, Object.assign({}, defaultProps, { onChange: onChange, datasource: datasource, query: query })));
        expect(screen.getByText('metric.test_label')).toBeInTheDocument();
        const service = yield screen.findByLabelText('Service');
        openMenu(service);
        yield select(service, 'Srv 2', { container: document.body });
        expect(onChange).toBeCalledWith(expect.objectContaining({ filters: ['metric.type', '=', 'type2'] }));
        expect(query).toEqual(defaultQuery);
        expect(screen.queryByText('metric.test_label')).not.toBeInTheDocument();
    }));
    it('resets query to defaults (except filters) when metric changes', () => __awaiter(void 0, void 0, void 0, function* () {
        const groupBys = ['metric.test_groupby'];
        const query = createMockTimeSeriesList({
            filters: ['metric.test_label', '=', 'test', 'AND', 'metric.type', '=', 'type'],
            groupBys,
            preprocessor: PreprocessorType.Delta,
        });
        const onChange = jest.fn();
        const datasource = createMockDatasource({
            filterMetricsByType: jest
                .fn()
                .mockResolvedValue([
                createMockMetricDescriptor(),
                createMockMetricDescriptor({ type: 'type2', displayName: 'metricName2', metricKind: MetricKind.GAUGE }),
            ]),
            getMetricTypes: jest
                .fn()
                .mockResolvedValue([
                createMockMetricDescriptor(),
                createMockMetricDescriptor({ type: 'type2', displayName: 'metricName2', metricKind: MetricKind.GAUGE }),
            ]),
            getLabels: jest.fn().mockResolvedValue({ 'metric.test_groupby': '' }),
            templateSrv: new TemplateSrv(),
        });
        const defaultQuery = Object.assign(Object.assign(Object.assign({}, query), defaultTimeSeriesList(datasource)), { filters: query.filters });
        render(React.createElement(VisualMetricQueryEditor, Object.assign({}, defaultProps, { onChange: onChange, datasource: datasource, query: query })));
        expect(document.body).toHaveTextContent('metric.test_label');
        expect(yield screen.findByText('Delta')).toBeInTheDocument();
        expect(yield screen.findByText('metric.test_groupby')).toBeInTheDocument();
        const metric = yield screen.findByLabelText('Metric name');
        openMenu(metric);
        yield userEvent.type(metric, 'type2');
        yield waitFor(() => expect(document.body).toHaveTextContent('metricName2'));
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            yield select(metric, 'metricName2', { container: document.body });
        }));
        expect(onChange).toBeCalledWith(expect.objectContaining({ filters: ['metric.test_label', '=', 'test', 'AND', 'metric.type', '=', 'type2'] }));
        expect(query).toEqual(defaultQuery);
        expect(document.body).toHaveTextContent('metric.test_label');
        expect(screen.queryByText('Delta')).not.toBeInTheDocument();
        expect(screen.queryByText('metric.test_groupby')).not.toBeInTheDocument();
    }));
    it('updates labels on time range change', () => __awaiter(void 0, void 0, void 0, function* () {
        const timeSrv = getTimeSrv();
        const query = createMockTimeSeriesList();
        const onChange = jest.fn();
        const datasource = createMockDatasource({
            getMetricTypes: jest.fn().mockResolvedValue([createMockMetricDescriptor()]),
            getLabels: jest
                .fn()
                .mockResolvedValue(timeSrv.time.from === 'now-6h' ? { 'metric.test_groupby': '' } : { 'metric.test_groupby_1': '' }),
            templateSrv: new TemplateSrv(),
            timeSrv,
        });
        const { rerender } = render(React.createElement(VisualMetricQueryEditor, Object.assign({}, defaultProps, { onChange: onChange, datasource: datasource, query: query })));
        const service = yield screen.findByLabelText('Service');
        openMenu(service);
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            yield select(service, 'Srv', { container: document.body });
        }));
        const metricName = yield screen.findByLabelText('Metric name');
        openMenu(metricName);
        yield waitFor(() => expect(document.body).toHaveTextContent('metricName'));
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            yield select(metricName, 'metricName', { container: document.body });
        }));
        const groupBy = yield screen.findByLabelText('Group by');
        openMenu(groupBy);
        yield waitFor(() => expect(document.body).toHaveTextContent('metric.test_groupby'));
        timeSrv.setTime({ from: 'now-12h', to: 'now' });
        const datasourceUpdated = createMockDatasource({
            timeSrv,
            getLabels: jest.fn().mockResolvedValue({ 'metric.test_groupby_1': '' }),
        });
        rerender(React.createElement(VisualMetricQueryEditor, Object.assign({}, defaultProps, { onChange: onChange, datasource: datasourceUpdated, query: query })));
        openMenu(groupBy);
        yield waitFor(() => expect(document.body).toHaveTextContent('metric.test_groupby_1'));
    }));
});
//# sourceMappingURL=VisualMetricQueryEditor.test.js.map