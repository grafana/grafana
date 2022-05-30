import { AnnotationQuery } from '@grafana/data';

import { AzureMonitorQuery, AzureQueryType } from '../types';

import migrateAnnotation from './migrateAnnotation';

const OLD_ANNOTATION: AnnotationQuery<AzureMonitorQuery> = {
  datasource: null,
  enable: true,
  iconColor: 'red',
  name: 'azure-activity',

  queryType: 'Azure Log Analytics',
  subscription: 'abc-123-def-456',
  rawQuery: 'AzureActivity\r\n| where $__timeFilter() \r\n| project TimeGenerated, Text=OperationName',
  workspace:
    '/subscriptions/abc-123-def-456/resourcegroups/our-datasource/providers/microsoft.operationalinsights/workspaces/azureactivitylog',

  target: {
    refId: 'Anno',
  },
};

const NEW_ANNOTATION: AnnotationQuery<AzureMonitorQuery> = {
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
      resource:
        '/subscriptions/abc-123-def-456/resourcegroups/our-datasource/providers/microsoft.operationalinsights/workspaces/azureactivitylog',
    },
  },
};

describe('AzureMonitor: migrateAnnotation', () => {
  it('migrates old annotations to AzureMonitorQuery', () => {
    const migrated = migrateAnnotation(OLD_ANNOTATION);
    expect(migrated).toEqual(NEW_ANNOTATION);
  });

  it('passes through already migrated queries untouched', () => {
    const newAnnotation = { ...NEW_ANNOTATION };
    delete newAnnotation.rawQuery;
    delete newAnnotation.workspace;
    delete newAnnotation.subscription;
    delete newAnnotation.queryType;

    const migrated = migrateAnnotation(newAnnotation);

    // We use .toBe because we want to assert that the object identity did not change!!!
    expect(migrated).toBe(newAnnotation);
  });
});
