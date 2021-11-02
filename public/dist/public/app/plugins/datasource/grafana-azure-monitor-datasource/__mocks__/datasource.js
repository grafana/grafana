import { mocked } from 'ts-jest/utils';
export default function createMockDatasource() {
    // We make this a partial so we get _some_ kind of type safety when making this, rather than
    // having it be any or casted immediately to Datasource
    var _mockDatasource = {
        getVariables: jest.fn().mockReturnValue([]),
        azureMonitorDatasource: {
            isConfigured: function () {
                return true;
            },
            getSubscriptions: jest.fn().mockResolvedValueOnce([]),
        },
        getAzureLogAnalyticsWorkspaces: jest.fn().mockResolvedValueOnce([]),
        getResourceGroups: jest.fn().mockResolvedValueOnce([]),
        getMetricDefinitions: jest.fn().mockResolvedValueOnce([]),
        getResourceNames: jest.fn().mockResolvedValueOnce([]),
        getMetricNamespaces: jest.fn().mockResolvedValueOnce([]),
        getMetricNames: jest.fn().mockResolvedValueOnce([]),
        getMetricMetadata: jest.fn().mockResolvedValueOnce({
            primaryAggType: 'Average',
            supportedAggTypes: ['Average', 'Maximum', 'Minimum'],
            supportedTimeGrains: [],
            dimensions: [],
        }),
        azureLogAnalyticsDatasource: {
            getKustoSchema: function () { return Promise.resolve(); },
        },
        resourcePickerData: {
            getResourcePickerData: function () { return ({}); },
            getResourcesForResourceGroup: function () { return ({}); },
            getResourceURIFromWorkspace: function () { return ''; },
        },
    };
    var mockDatasource = _mockDatasource;
    return mocked(mockDatasource, true);
}
//# sourceMappingURL=datasource.js.map