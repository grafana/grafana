import { __assign } from "tslib";
import { AzureQueryType } from '../types';
import migrateAnnotation from './migrateAnnotation';
var OLD_ANNOTATION = {
    datasource: null,
    enable: true,
    iconColor: 'red',
    name: 'azure-activity',
    queryType: 'Azure Log Analytics',
    subscription: 'abc-123-def-456',
    rawQuery: 'AzureActivity\r\n| where $__timeFilter() \r\n| project TimeGenerated, Text=OperationName',
    workspace: '/subscriptions/abc-123-def-456/resourcegroups/our-datasource/providers/microsoft.operationalinsights/workspaces/azureactivitylog',
    target: {
        refId: 'Anno',
    },
};
var NEW_ANNOTATION = {
    datasource: null,
    enable: true,
    iconColor: 'red',
    name: 'azure-activity',
    rawQuery: undefined,
    workspace: undefined,
    subscription: undefined,
    queryType: undefined,
    target: {
        refId: 'Anno',
        queryType: AzureQueryType.LogAnalytics,
        azureLogAnalytics: {
            query: 'AzureActivity\r\n| where $__timeFilter() \r\n| project TimeGenerated, Text=OperationName',
            resource: '/subscriptions/abc-123-def-456/resourcegroups/our-datasource/providers/microsoft.operationalinsights/workspaces/azureactivitylog',
        },
    },
};
describe('AzureMonitor: migrateAnnotation', function () {
    it('migrates old annotations to AzureMonitorQuery', function () {
        var migrated = migrateAnnotation(OLD_ANNOTATION);
        expect(migrated).toEqual(NEW_ANNOTATION);
    });
    it('passes through already migrated queries untouched', function () {
        var newAnnotation = __assign({}, NEW_ANNOTATION);
        delete newAnnotation.rawQuery;
        delete newAnnotation.workspace;
        delete newAnnotation.subscription;
        delete newAnnotation.queryType;
        var migrated = migrateAnnotation(newAnnotation);
        // We use .toBe because we want to assert that the object identity did not change!!!
        expect(migrated).toBe(newAnnotation);
    });
});
//# sourceMappingURL=migrateAnnotation.test.js.map