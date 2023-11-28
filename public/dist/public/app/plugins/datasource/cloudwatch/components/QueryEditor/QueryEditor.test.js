import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { config } from '@grafana/runtime';
import { setupMockedDataSource } from '../../__mocks__/CloudWatchDataSource';
import { validLogsQuery, validMetricQueryBuilderQuery, validMetricQueryCodeQuery, validMetricSearchBuilderQuery, validMetricSearchCodeQuery, } from '../../__mocks__/queries';
import { MetricEditorMode, MetricQueryType } from '../../types';
import { QueryEditor } from './QueryEditor';
// the following three fields are added to legacy queries in the dashboard migrator
const migratedFields = {
    statistic: 'Average',
    metricEditorMode: MetricEditorMode.Builder,
    metricQueryType: MetricQueryType.Query,
};
const props = {
    datasource: setupMockedDataSource().datasource,
    onRunQuery: jest.fn(),
    onChange: jest.fn(),
    query: {},
};
const FAKE_EDITOR_LABEL = 'FakeEditor';
jest.mock('./MetricsQueryEditor/SQLCodeEditor', () => ({
    SQLCodeEditor: ({ sql, onChange }) => {
        return (React.createElement(React.Fragment, null,
            React.createElement("label", { htmlFor: "cloudwatch-fake-editor" }, FAKE_EDITOR_LABEL),
            React.createElement("input", { id: "cloudwatch-fake-editor", value: sql, onChange: (e) => onChange(e.currentTarget.value) })));
    },
}));
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { config: Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime').config), { featureToggles: {
            cloudWatchCrossAccountQuerying: true,
        } }) })));
export { SQLCodeEditor } from './MetricsQueryEditor/SQLCodeEditor';
describe('QueryEditor should render right editor', () => {
    describe('when using grafana 6.3.0 metric query', () => {
        it('should render the metrics query editor', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = Object.assign(Object.assign({}, migratedFields), { dimensions: {
                    InstanceId: 'i-123',
                }, expression: '', highResolution: false, id: '', metricName: 'CPUUtilization', namespace: 'AWS/EC2', period: '', refId: 'A', region: 'default', returnData: false });
            render(React.createElement(QueryEditor, Object.assign({}, props, { query: query })));
            expect(yield screen.findByText('Metric name')).toBeInTheDocument();
        }));
    });
    describe('when using grafana 7.0.0 style metrics query', () => {
        it('should render the metrics query editor', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = Object.assign(Object.assign({}, migratedFields), { alias: '', apiMode: 'Metrics', dimensions: {
                    InstanceId: 'i-123',
                }, expression: '', id: '', logGroupNames: [], matchExact: true, metricName: 'CPUUtilization', namespace: 'AWS/EC2', period: '', queryMode: 'Metrics', refId: 'A', region: 'ap-northeast-2', statistics: 'Average' });
            render(React.createElement(QueryEditor, Object.assign({}, props, { query: query })));
            expect(yield screen.findByText('Metric name')).toBeInTheDocument();
        }));
    });
    describe('when using grafana 7.0.0 style logs query', () => {
        it('should render the logs query editor', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = Object.assign(Object.assign({}, migratedFields), { alias: '', apiMode: 'Logs', dimensions: {
                    InstanceId: 'i-123',
                }, expression: '', id: '', logGroupNames: [], matchExact: true, metricName: 'CPUUtilization', namespace: 'AWS/EC2', period: '', queryMode: 'Logs', refId: 'A', region: 'ap-northeast-2', statistic: 'Average' });
            render(React.createElement(QueryEditor, Object.assign({}, props, { query: query })));
            expect(yield screen.findByText('Select log groups')).toBeInTheDocument();
        }));
    });
    describe('when using grafana query from curated ec2 dashboard', () => {
        it('should render the metrics query editor', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = Object.assign(Object.assign({}, migratedFields), { alias: 'Inbound', dimensions: {
                    InstanceId: '*',
                }, expression: "SUM(REMOVE_EMPTY(SEARCH('{AWS/EC2,InstanceId} MetricName=\"NetworkIn\"', 'Sum', $period)))/$period", id: '', matchExact: true, metricName: 'NetworkOut', namespace: 'AWS/EC2', period: '$period', refId: 'B', region: '$region', statistic: 'Average' });
            render(React.createElement(QueryEditor, Object.assign({}, props, { query: query })));
            expect(yield screen.findByText('Metric name')).toBeInTheDocument();
        }));
    });
    describe('monitoring badge', () => {
        let originalValue;
        let datasourceMock;
        beforeEach(() => {
            datasourceMock = setupMockedDataSource();
            datasourceMock.datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(true);
            datasourceMock.datasource.resources.getMetrics = jest.fn().mockResolvedValue([]);
            datasourceMock.datasource.resources.getDimensionKeys = jest.fn().mockResolvedValue([]);
            originalValue = config.featureToggles.cloudWatchCrossAccountQuerying;
        });
        afterEach(() => {
            config.featureToggles.cloudWatchCrossAccountQuerying = originalValue;
        });
        describe('should be displayed when a monitoring account is returned and', () => {
            const cases = [
                { name: 'it is logs query and feature is enabled', query: validLogsQuery, toggle: true },
                {
                    name: 'it is metric search builder query and feature is enabled',
                    query: validMetricSearchBuilderQuery,
                    toggle: true,
                },
                {
                    name: 'it is metric search code query and feature is enabled',
                    query: validMetricSearchCodeQuery,
                    toggle: true,
                },
            ];
            test.each(cases)('$name', ({ query, toggle }) => __awaiter(void 0, void 0, void 0, function* () {
                config.featureToggles.cloudWatchCrossAccountQuerying = toggle;
                render(React.createElement(QueryEditor, Object.assign({}, props, { datasource: datasourceMock.datasource, query: query })));
                expect(yield screen.findByText('Monitoring account')).toBeInTheDocument();
            }));
        });
        describe('should not be displayed when a monitoring account is returned and', () => {
            const cases = [
                {
                    name: 'it is metric query builder query and toggle is enabled',
                    query: validMetricQueryBuilderQuery,
                    toggle: true,
                },
                {
                    name: 'it is metric query code query and toggle is not enabled',
                    query: validMetricQueryCodeQuery,
                    toggle: false,
                },
                { name: 'it is logs query and feature is not enabled', query: validLogsQuery, toggle: false },
                {
                    name: 'it is metric search builder query and feature is not enabled',
                    query: validMetricSearchBuilderQuery,
                    toggle: false,
                },
                {
                    name: 'it is metric search code query and feature is not enabled',
                    query: validMetricSearchCodeQuery,
                    toggle: false,
                },
            ];
            test.each(cases)('$name', ({ query, toggle }) => __awaiter(void 0, void 0, void 0, function* () {
                config.featureToggles.cloudWatchCrossAccountQuerying = toggle;
                render(React.createElement(QueryEditor, Object.assign({}, props, { datasource: datasourceMock.datasource, query: query })));
                expect(yield screen.findByText('Run queries')).toBeInTheDocument();
                expect(screen.queryByText('Monitoring account')).toBeNull();
            }));
        });
    });
    describe('QueryHeader', () => {
        it('should display metric actions in header when metric query is used', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(QueryEditor, Object.assign({}, props, { query: validMetricQueryCodeQuery })));
            expect(yield screen.findByText('CloudWatch Metrics')).toBeInTheDocument();
            expect(screen.getByLabelText(/Region.*/)).toBeInTheDocument();
            expect(screen.getByLabelText('Builder')).toBeInTheDocument();
            expect(screen.getByLabelText('Code')).toBeInTheDocument();
            expect(screen.getByText('Metric Query')).toBeInTheDocument();
        }));
        it('should display metric actions in header when metric query is used', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(QueryEditor, Object.assign({}, props, { query: validLogsQuery })));
            expect(yield screen.findByText('CloudWatch Logs')).toBeInTheDocument();
            expect(screen.getByLabelText(/Region.*/)).toBeInTheDocument();
            expect(screen.queryByLabelText('Builder')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Code')).not.toBeInTheDocument();
            expect(screen.queryByText('Metric Query')).not.toBeInTheDocument();
        }));
    });
    describe('metrics editor should handle editor modes correctly', () => {
        it('when metric query type is metric search and editor mode is builder', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(QueryEditor, Object.assign({}, props, { query: validMetricSearchBuilderQuery })));
            expect(yield screen.findByText('Metric Search')).toBeInTheDocument();
            const radio = screen.getByLabelText('Builder');
            expect(radio instanceof HTMLInputElement && radio.checked).toBeTruthy();
        }));
        it('when metric query type is metric search and editor mode is raw', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(QueryEditor, Object.assign({}, props, { query: validMetricSearchCodeQuery })));
            expect(yield screen.findByText('Metric Search')).toBeInTheDocument();
            const radio = screen.getByLabelText('Code');
            expect(radio instanceof HTMLInputElement && radio.checked).toBeTruthy();
        }));
        it('when metric query type is metric query and editor mode is builder', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(QueryEditor, Object.assign({}, props, { query: validMetricQueryBuilderQuery })));
            expect(yield screen.findByText('Metric Query')).toBeInTheDocument();
            const radio = screen.getByLabelText('Builder');
            expect(radio instanceof HTMLInputElement && radio.checked).toBeTruthy();
        }));
        it('when metric query type is metric query and editor mode is raw', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(QueryEditor, Object.assign({}, props, { query: validMetricQueryCodeQuery })));
            expect(yield screen.findByText('Metric Query')).toBeInTheDocument();
            const radio = screen.getByLabelText('Code');
            expect(radio instanceof HTMLInputElement && radio.checked).toBeTruthy();
        }));
    });
    describe('confirm modal', () => {
        it('should be shown when moving from code editor to builder when in sql mode', () => __awaiter(void 0, void 0, void 0, function* () {
            const sqlQuery = 'SELECT * FROM test';
            render(React.createElement(QueryEditor, Object.assign({}, props, { query: Object.assign(Object.assign({}, validMetricQueryCodeQuery), { sqlExpression: sqlQuery }), onChange: jest.fn(), onRunQuery: jest.fn() })));
            // the modal should not be shown unless the code editor is "dirty", so need to trigger a change
            const codeEditorElement = screen.getByLabelText(FAKE_EDITOR_LABEL);
            yield userEvent.clear(codeEditorElement);
            yield userEvent.type(codeEditorElement, 'select * from ');
            const builderElement = screen.getByLabelText('Builder');
            expect(builderElement).toBeInTheDocument();
            yield userEvent.click(builderElement);
            const modalTitleElem = screen.getByText('Are you sure?');
            expect(modalTitleElem).toBeInTheDocument();
        }));
        it('should not be shown when moving from builder to code when in sql mode', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(QueryEditor, Object.assign({}, props, { query: validMetricQueryBuilderQuery, onChange: jest.fn(), onRunQuery: jest.fn() })));
            const builderElement = screen.getByLabelText('Builder');
            expect(builderElement).toBeInTheDocument();
            yield userEvent.click(builderElement);
            expect(screen.queryByText('Are you sure?')).toBeNull();
        }));
        it('should not be shown when moving from code to builder when in search mode', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(QueryEditor, Object.assign({}, props, { query: validMetricSearchCodeQuery, onChange: jest.fn(), onRunQuery: jest.fn() })));
            const builderElement = screen.getByLabelText('Builder');
            expect(builderElement).toBeInTheDocument();
            yield userEvent.click(builderElement);
            expect(screen.queryByText('Are you sure?')).toBeNull();
        }));
    });
});
//# sourceMappingURL=QueryEditor.test.js.map