import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import selectEvent from 'react-select-event';
import { config } from '@grafana/runtime';
import { setupMockedDataSource } from '../../__mocks__/CloudWatchDataSource';
import { validLogsQuery, validMetricSearchBuilderQuery } from '../../__mocks__/queries';
import { DEFAULT_LOGS_QUERY_STRING } from '../../defaultQueries';
import QueryHeader from './QueryHeader';
const originalFeatureToggleValue = config.featureToggles.cloudWatchCrossAccountQuerying;
const ds = setupMockedDataSource({
    variables: [],
});
ds.datasource.resources.getRegions = jest.fn().mockResolvedValue([]);
describe('QueryHeader', () => {
    describe('when changing region', () => {
        afterEach(() => {
            config.featureToggles.cloudWatchCrossAccountQuerying = originalFeatureToggleValue;
        });
        const { datasource } = setupMockedDataSource();
        datasource.resources.getRegions = jest.fn().mockResolvedValue([
            { value: 'us-east-2', label: 'us-east-2' },
            { value: 'us-east-1', label: 'us-east-1' },
        ]);
        it('should reset account id if new region is not monitoring account', () => __awaiter(void 0, void 0, void 0, function* () {
            config.featureToggles.cloudWatchCrossAccountQuerying = true;
            const onChange = jest.fn();
            datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(false);
            render(React.createElement(QueryHeader, { datasource: datasource, query: Object.assign(Object.assign({}, validMetricSearchBuilderQuery), { region: 'us-east-1', accountId: 'all' }), onChange: onChange, onRunQuery: jest.fn(), dataIsStale: false }));
            yield waitFor(() => expect(screen.queryByText('us-east-1')).toBeInTheDocument());
            yield selectEvent.select(screen.getByLabelText(/Region/), 'us-east-2', { container: document.body });
            expect(onChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, validMetricSearchBuilderQuery), { region: 'us-east-2', accountId: undefined }));
        }));
        it('should not reset account id if new region is a monitoring account', () => __awaiter(void 0, void 0, void 0, function* () {
            config.featureToggles.cloudWatchCrossAccountQuerying = true;
            const onChange = jest.fn();
            datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(true);
            render(React.createElement(QueryHeader, { datasource: datasource, query: Object.assign(Object.assign({}, validMetricSearchBuilderQuery), { region: 'us-east-1', accountId: '123' }), onChange: onChange, onRunQuery: jest.fn(), dataIsStale: false }));
            yield waitFor(() => expect(screen.queryByText('us-east-1')).toBeInTheDocument());
            yield selectEvent.select(screen.getByLabelText(/Region/), 'us-east-2', { container: document.body });
            expect(onChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, validMetricSearchBuilderQuery), { region: 'us-east-2', accountId: '123' }));
        }));
        it('should not call isMonitoringAccount if its a logs query', () => __awaiter(void 0, void 0, void 0, function* () {
            config.featureToggles.cloudWatchCrossAccountQuerying = true;
            const onChange = jest.fn();
            datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(true);
            render(React.createElement(QueryHeader, { dataIsStale: false, datasource: datasource, query: Object.assign(Object.assign({}, validLogsQuery), { region: 'us-east-1' }), onChange: onChange, onRunQuery: jest.fn() }));
            yield waitFor(() => expect(screen.queryByText('us-east-1')).toBeInTheDocument());
            yield selectEvent.select(screen.getByLabelText(/Region/), 'us-east-2', { container: document.body });
            expect(datasource.resources.isMonitoringAccount).not.toHaveBeenCalledWith('us-east-2');
        }));
        it('should not call isMonitoringAccount if feature toggle is not enabled', () => __awaiter(void 0, void 0, void 0, function* () {
            config.featureToggles.cloudWatchCrossAccountQuerying = false;
            const onChange = jest.fn();
            datasource.resources.isMonitoringAccount = jest.fn();
            render(React.createElement(QueryHeader, { dataIsStale: false, datasource: datasource, query: Object.assign(Object.assign({}, validLogsQuery), { region: 'us-east-1' }), onChange: onChange, onRunQuery: jest.fn() }));
            yield waitFor(() => expect(screen.queryByText('us-east-1')).toBeInTheDocument());
            yield selectEvent.select(screen.getByLabelText(/Region/), 'us-east-2', { container: document.body });
            expect(datasource.resources.isMonitoringAccount).not.toHaveBeenCalledWith();
        }));
    });
    describe('when changing query mode', () => {
        const { datasource } = setupMockedDataSource();
        it('should set default log query when switching to log mode', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(false);
            render(React.createElement(QueryHeader, { datasource: datasource, query: Object.assign(Object.assign({}, validMetricSearchBuilderQuery), { expression: 'foo' }), onChange: onChange, onRunQuery: jest.fn(), dataIsStale: false }));
            expect(yield screen.findByText('CloudWatch Metrics')).toBeInTheDocument();
            yield selectEvent.select(yield screen.findByLabelText('Query mode'), 'CloudWatch Logs', {
                container: document.body,
            });
            expect(onChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, validMetricSearchBuilderQuery), { logGroupNames: undefined, logGroups: [], queryMode: 'Logs', sqlExpression: '', expression: DEFAULT_LOGS_QUERY_STRING }));
        }));
        it('should set expression to empty when switching to metrics mode', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(false);
            render(React.createElement(QueryHeader, { datasource: datasource, query: Object.assign(Object.assign({}, validMetricSearchBuilderQuery), { queryMode: 'Logs', expression: 'foo' }), onChange: onChange, onRunQuery: jest.fn(), dataIsStale: false }));
            expect(yield screen.findByText('CloudWatch Logs')).toBeInTheDocument();
            yield selectEvent.select(yield screen.findByLabelText('Query mode'), 'CloudWatch Metrics', {
                container: document.body,
            });
            expect(onChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, validMetricSearchBuilderQuery), { logGroupNames: undefined, logGroups: [], sqlExpression: '', expression: '' }));
        }));
    });
    describe('log expression', () => {
        const { datasource } = setupMockedDataSource();
        it('should disable run query button when empty', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(false);
            render(React.createElement(QueryHeader, { datasource: datasource, query: Object.assign(Object.assign({}, validMetricSearchBuilderQuery), { queryMode: 'Logs', expression: '' }), onChange: onChange, onRunQuery: jest.fn(), dataIsStale: false }));
            expect(yield screen.findByText('Run queries')).toBeInTheDocument();
            expect(screen.getByText('Run queries').closest('button')).toBeDisabled();
        }));
        it('should enable run query button when set', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChange = jest.fn();
            datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(false);
            render(React.createElement(QueryHeader, { datasource: datasource, query: Object.assign(Object.assign({}, validMetricSearchBuilderQuery), { queryMode: 'Logs', expression: DEFAULT_LOGS_QUERY_STRING }), onChange: onChange, onRunQuery: jest.fn(), dataIsStale: false }));
            expect(yield screen.findByText('Run queries')).toBeInTheDocument();
            expect(screen.getByText('Run queries').closest('button')).not.toBeDisabled();
        }));
    });
});
//# sourceMappingURL=QueryHeader.test.js.map