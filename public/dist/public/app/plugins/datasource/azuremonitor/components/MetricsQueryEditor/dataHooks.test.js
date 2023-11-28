import { __awaiter } from "tslib";
import { renderHook, waitFor } from '@testing-library/react';
import createMockDatasource from '../../__mocks__/datasource';
import { AzureQueryType } from '../../types';
import { useMetricNames, useMetricNamespaces, useMetricMetadata, } from './dataHooks';
const opt = (text, value) => ({ text, value });
describe('AzureMonitor: metrics dataHooks', () => {
    const bareQuery = {
        refId: 'A',
        queryType: AzureQueryType.AzureMonitor,
        subscription: 'sub-abc-123',
    };
    const testTable = [
        {
            name: 'useMetricNames',
            hook: useMetricNames,
            emptyQueryPartial: {
                metricNamespace: 'azure/vm',
                resources: [
                    {
                        resourceGroup: 'rg',
                        resourceName: 'rn',
                    },
                ],
            },
            customProperties: {
                metricNamespace: 'azure/vm',
                resources: [
                    {
                        resourceGroup: 'rg',
                        resourceName: 'rn',
                    },
                ],
                metricName: 'metric-$ENVIRONMENT',
            },
            expectedOptions: [
                {
                    label: 'Percentage CPU',
                    value: 'percentage-cpu',
                },
                {
                    label: 'Free memory',
                    value: 'free-memory',
                },
            ],
            expectedCustomPropertyResults: [
                { label: 'Percentage CPU', value: 'percentage-cpu' },
                { label: 'Free memory', value: 'free-memory' },
                { label: 'metric-$ENVIRONMENT', value: 'metric-$ENVIRONMENT' },
            ],
        },
        {
            name: 'useMetricNamespaces',
            hook: useMetricNamespaces,
            emptyQueryPartial: {
                metricNamespace: 'azure/vm',
                resources: [
                    {
                        resourceGroup: 'rg',
                        resourceName: 'rn',
                    },
                ],
            },
            customProperties: {
                metricNamespace: 'azure/vm-$ENVIRONMENT',
                resources: [
                    {
                        resourceGroup: 'rg',
                        resourceName: 'rn',
                    },
                ],
                metricName: 'metric-name',
            },
            expectedOptions: [
                {
                    label: 'Compute Virtual Machine',
                    value: 'azure/vmc',
                },
                {
                    label: 'Database NS',
                    value: 'azure/dbns',
                },
                {
                    label: 'azure/vm',
                    value: 'azure/vm',
                },
            ],
            expectedCustomPropertyResults: [
                { label: 'Compute Virtual Machine', value: 'azure/vmc' },
                { label: 'Database NS', value: 'azure/dbns' },
                { label: 'azure/vm-$ENVIRONMENT', value: 'azure/vm-$ENVIRONMENT' },
            ],
        },
    ];
    let datasource;
    let onChange;
    let setError;
    beforeEach(() => {
        onChange = jest.fn();
        setError = jest.fn();
        datasource = createMockDatasource();
        datasource.getVariables = jest.fn().mockReturnValue(['$sub', '$rg', '$rt', '$variable']);
        datasource.azureMonitorDatasource.getSubscriptions = jest
            .fn()
            .mockResolvedValue([opt('sub-abc-123', 'sub-abc-123')]);
        datasource.getResourceGroups = jest
            .fn()
            .mockResolvedValue([
            opt('Web App - Production', 'web-app-production'),
            opt('Web App - Development', 'web-app-development'),
        ]);
        datasource.getResourceNames = jest
            .fn()
            .mockResolvedValue([opt('Web server', 'web-server'), opt('Job server', 'job-server')]);
        datasource.azureMonitorDatasource.getMetricNames = jest
            .fn()
            .mockResolvedValue([opt('Percentage CPU', 'percentage-cpu'), opt('Free memory', 'free-memory')]);
        datasource.azureMonitorDatasource.getMetricNamespaces = jest
            .fn()
            .mockResolvedValue([opt('Compute Virtual Machine', 'azure/vmc'), opt('Database NS', 'azure/dbns')]);
        datasource.azureMonitorDatasource.getMetricMetadata = jest.fn().mockResolvedValue({
            primaryAggType: 'Average',
            supportedAggTypes: ['Average'],
            supportedTimeGrains: [
                { label: 'Auto', value: 'auto' },
                { label: '1 minute', value: 'PT1M' },
                { label: '5 minutes', value: 'PT5M' },
                { label: '15 minutes', value: 'PT15M' },
                { label: '30 minutes', value: 'PT30M' },
                { label: '1 hour', value: 'PT1H' },
                { label: '6 hours', value: 'PT6H' },
                { label: '12 hours', value: 'PT12H' },
                { label: '1 day', value: 'P1D' },
            ],
            dimensions: [],
        });
    });
    describe.each(testTable)('scenario %#: $name', (scenario) => {
        it('returns values', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = Object.assign(Object.assign({}, bareQuery), { azureMonitor: scenario.emptyQueryPartial });
            const { result } = renderHook(() => scenario.hook(query, datasource, onChange, setError));
            yield waitFor(() => {
                expect(result.current).toEqual(scenario.expectedOptions);
            });
        }));
        it('adds custom properties as a valid option', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = Object.assign(Object.assign(Object.assign({}, bareQuery), { azureMonitor: scenario.customProperties }), scenario.topLevelCustomProperties);
            const { result } = renderHook(() => scenario.hook(query, datasource, onChange, setError));
            yield waitFor(() => {
                expect(result.current).toEqual(scenario.expectedCustomPropertyResults);
            });
        }));
    });
    describe('useMetricsMetadataHook', () => {
        const metricsMetadataConfig = {
            name: 'useMetricMetadata',
            hook: useMetricMetadata,
            emptyQueryPartial: {
                resources: [
                    {
                        resourceGroup: 'rg',
                        resourceName: 'rn',
                    },
                ],
                metricNamespace: 'azure/vm',
                metricName: 'Average CPU',
            },
            customProperties: {},
            expectedOptions: {
                aggOptions: [{ label: 'Average', value: 'Average' }],
                timeGrains: [
                    { label: 'Auto', value: 'auto' },
                    { label: '1 minute', value: 'PT1M' },
                    { label: '5 minutes', value: 'PT5M' },
                    { label: '15 minutes', value: 'PT15M' },
                    { label: '30 minutes', value: 'PT30M' },
                    { label: '1 hour', value: 'PT1H' },
                    { label: '6 hours', value: 'PT6H' },
                    { label: '12 hours', value: 'PT12H' },
                    { label: '1 day', value: 'P1D' },
                ],
                dimensions: [],
                isLoading: false,
                supportedAggTypes: ['Average'],
                primaryAggType: 'Average',
            },
        };
        it('returns values', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = Object.assign(Object.assign({}, bareQuery), { azureMonitor: metricsMetadataConfig.emptyQueryPartial });
            const { result } = renderHook(() => metricsMetadataConfig.hook(query, datasource, onChange));
            yield waitFor(() => {
                expect(result.current).toEqual(metricsMetadataConfig.expectedOptions);
                expect(onChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, query), { azureMonitor: Object.assign(Object.assign({}, query.azureMonitor), { aggregation: result.current.primaryAggType, timeGrain: 'auto', allowedTimeGrainsMs: [60000, 300000, 900000, 1800000, 3600000, 21600000, 43200000, 86400000] }) }));
            });
        }));
    });
    describe('useMetricNamespaces', () => {
        const metricNamespacesConfig = {
            name: 'useMetricNamespaces',
            hook: useMetricNamespaces,
            emptyQueryPartial: {
                resources: [
                    {
                        resourceGroup: 'rg',
                        resourceName: 'rn',
                    },
                ],
                metricNamespace: 'azure/vm',
            },
            customProperties: {},
            expectedOptions: [
                { label: 'Compute Virtual Machine', value: 'azure/vmc' },
                { label: 'Database NS', value: 'azure/dbns' },
                { label: 'azure/vm', value: 'azure/vm' },
            ],
        };
        it('call getMetricNamespaces without global region', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = Object.assign(Object.assign({}, bareQuery), { azureMonitor: metricNamespacesConfig.emptyQueryPartial });
            const { result } = renderHook(() => metricNamespacesConfig.hook(query, datasource, onChange, jest.fn()));
            yield waitFor(() => {
                expect(result.current).toEqual(metricNamespacesConfig.expectedOptions);
                expect(datasource.azureMonitorDatasource.getMetricNamespaces).toHaveBeenCalledWith(expect.objectContaining({
                    resourceGroup: 'rg',
                    resourceName: 'rn',
                    metricNamespace: 'azure/vm',
                }), 
                // Here, "global" should be false
                false);
            });
        }));
    });
});
//# sourceMappingURL=dataHooks.test.js.map