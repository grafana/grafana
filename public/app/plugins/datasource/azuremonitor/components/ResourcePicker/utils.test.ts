import createMockQuery from '../../mocks/query';

import { ResourceRowGroup, ResourceRowType } from './types';
import {
  findRow,
  findRows,
  parseMultipleResourceDetails,
  parseResourceDetails,
  parseResourceURI,
  resourcesToStrings,
  setResources,
} from './utils';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    replace: (val: string) => {
      return val;
    },
  }),
}));

describe('AzureMonitor ResourcePicker utils', () => {
  describe('parseResourceURI', () => {
    it('should parse subscription URIs', () => {
      expect(parseResourceURI('/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toEqual({
        subscription: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      });
    });

    it('should parse resource group URIs', () => {
      expect(
        parseResourceURI('/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources')
      ).toEqual({
        subscription: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        resourceGroup: 'cloud-datasources',
      });
    });

    it('should parse resource URIs', () => {
      expect(
        parseResourceURI(
          '/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.Compute/virtualMachines/GithubTestDataVM'
        )
      ).toEqual({
        subscription: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        resourceGroup: 'cloud-datasources',
        metricNamespace: 'Microsoft.Compute/virtualMachines',
        resourceName: 'GithubTestDataVM',
      });
    });

    it('should parse resource URIs with a subresource', () => {
      expect(
        parseResourceURI(
          '/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.Storage/storageAccounts/csb100320016c43d2d0/fileServices/default'
        )
      ).toEqual({
        subscription: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        resourceGroup: 'cloud-datasources',
        metricNamespace: 'Microsoft.Storage/storageAccounts/fileServices',
        resourceName: 'csb100320016c43d2d0/default',
      });
    });

    it('returns undefined for invalid input', () => {
      expect(parseResourceURI('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toEqual({});
    });

    it('returns a valid response with a missing element in the metric namespace and name', () => {
      expect(
        parseResourceURI(
          '/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/foo'
        )
      ).toEqual({
        metricNamespace: 'foo',
        resourceGroup: 'cloud-datasources',
        resourceName: '',
        subscription: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      });

      expect(
        parseResourceURI(
          '/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/foo/bar'
        )
      ).toEqual({
        metricNamespace: 'foo/bar',
        resourceGroup: 'cloud-datasources',
        resourceName: '',
        subscription: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      });
    });
  });

  describe('findRow', () => {
    it('should find a row', () => {
      const rows: ResourceRowGroup = [
        { id: '', uri: '/subscription/sub', name: '', type: ResourceRowType.Subscription, typeLabel: '' },
      ];
      expect(findRow(rows, '/subscription/sub')).toEqual(rows[0]);
    });

    it('should find a row ignoring a subresource', () => {
      const rows: ResourceRowGroup = [
        {
          id: '',
          uri: '/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.Storage/storageAccounts/csb100320016c43d2d0',
          name: '',
          type: ResourceRowType.Resource,
          typeLabel: '',
        },
      ];
      expect(
        findRow(
          rows,
          '/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.Storage/storageAccounts/csb100320016c43d2d0/fileServices/default'
        )
      ).toEqual(rows[0]);
    });

    it('should find a row ignoring a metric namespace case', () => {
      const rows: ResourceRowGroup = [
        {
          id: '',
          uri: '/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/microsoft.storage/storageaccounts/csb100320016c43d2d0',
          name: '',
          type: ResourceRowType.Resource,
          typeLabel: '',
        },
      ];
      expect(
        findRow(
          rows,
          '/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.Storage/storageAccounts/csb100320016c43d2d0'
        )
      ).toEqual(rows[0]);
    });

    it('should find a row ignoring a resource group case', () => {
      const rows: ResourceRowGroup = [
        {
          id: '',
          uri: '/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/CLOUD-DATASOURCES/providers/microsoft.storage/storageaccounts/csb100320016c43d2d0',
          name: '',
          type: ResourceRowType.Resource,
          typeLabel: '',
        },
      ];
      expect(
        findRow(
          rows,
          '/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.Storage/storageAccounts/csb100320016c43d2d0'
        )
      ).toEqual(rows[0]);
    });

    it('should find a row matching the right subresource', () => {
      const rows: ResourceRowGroup = [
        {
          id: '',
          uri: '/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.Sql/servers/foo',
          name: '',
          type: ResourceRowType.Resource,
          typeLabel: '',
        },
        {
          id: '',
          uri: '/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.Sql/servers/foo/databases/bar',
          name: '',
          type: ResourceRowType.Resource,
          typeLabel: '',
        },
      ];
      expect(
        findRow(
          rows,
          '/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.Sql/servers/foo/databases/bar'
        )
      ).toEqual(rows[1]);
    });
  });

  describe('findRows', () => {
    it('should find multiple rows', () => {
      const rows: ResourceRowGroup = [
        { id: 'sub1', uri: '/subscriptions/sub1', name: '', type: ResourceRowType.Subscription, typeLabel: '' },
        { id: 'sub2', uri: '/subscriptions/sub2', name: '', type: ResourceRowType.Subscription, typeLabel: '' },
        { id: 'sub3', uri: '/subscriptions/sub3', name: '', type: ResourceRowType.Subscription, typeLabel: '' },
      ];
      expect(findRows(rows, ['/subscriptions/sub1', '/subscriptions/sub2'])).toEqual([rows[0], rows[1]]);
    });
  });

  describe('setResources', () => {
    it('updates a resource with a resource URI for Log Analytics', () => {
      expect(setResources(createMockQuery(), 'logs', ['/subscription/sub'])).toMatchObject({
        azureLogAnalytics: { resources: ['/subscription/sub'] },
      });
    });

    it('updates a resource with a resource URI for Traces', () => {
      expect(setResources(createMockQuery(), 'traces', ['/subscription/sub'])).toMatchObject({
        azureTraces: { resources: ['/subscription/sub'] },
      });
    });

    it('ignores an empty logs resource URI', () => {
      expect(setResources(createMockQuery(), 'logs', ['/subscription/sub', ''])).toMatchObject({
        azureLogAnalytics: { resources: ['/subscription/sub'] },
      });
    });

    it('ignores an empty traces resource URI', () => {
      expect(setResources(createMockQuery(), 'traces', ['/subscription/sub', ''])).toMatchObject({
        azureTraces: { resources: ['/subscription/sub'] },
      });
    });

    it('updates a resource with a resource parameters for Metrics', () => {
      expect(
        setResources(createMockQuery(), 'metrics', [
          {
            subscription: 'sub',
            resourceGroup: 'rg',
            metricNamespace: 'Microsoft.Storage/storageAccounts',
            resourceName: 'testacct',
            region: 'westus',
          },
        ])
      ).toMatchObject({
        subscription: 'sub',
        azureMonitor: {
          aggregation: undefined,
          metricName: undefined,
          metricNamespace: 'microsoft.storage/storageaccounts',
          region: 'westus',
          resources: [
            {
              resourceGroup: 'rg',
              resourceName: 'testacct',
            },
          ],
        },
      });
    });

    it('ignores a partially empty metrics resource', () => {
      expect(
        setResources(createMockQuery(), 'metrics', [
          {
            subscription: 'sub',
            resourceGroup: 'rg',
            metricNamespace: 'Microsoft.Storage/storageAccounts',
            resourceName: '',
            region: 'westus',
          },
        ])
      ).toMatchObject({
        subscription: 'sub',
        azureMonitor: {
          aggregation: undefined,
          metricName: undefined,
          metricNamespace: 'microsoft.storage/storageaccounts',
          region: 'westus',
          resources: [],
        },
      });
    });
  });

  describe('parseResourceDetails', () => {
    it('parses a string resource', () => {
      expect(
        parseResourceDetails(
          '/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.Sql/servers/foo/databases/bar',
          'useast'
        )
      ).toEqual({
        metricNamespace: 'Microsoft.Sql/servers/databases',
        resourceGroup: 'cloud-datasources',
        resourceName: 'foo/bar',
        subscription: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        region: 'useast',
      });
    });
  });

  describe('parseMultipleResourceDetails', () => {
    it('parses multiple string resources', () => {
      expect(
        parseMultipleResourceDetails(
          [
            '/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.Sql/servers/foo/databases/bar',
            '/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.Sql/servers/other/databases/resource',
          ],
          'useast'
        )
      ).toEqual([
        {
          metricNamespace: 'Microsoft.Sql/servers/databases',
          resourceGroup: 'cloud-datasources',
          resourceName: 'foo/bar',
          subscription: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          region: 'useast',
        },
        {
          metricNamespace: 'Microsoft.Sql/servers/databases',
          resourceGroup: 'cloud-datasources',
          resourceName: 'other/resource',
          subscription: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          region: 'useast',
        },
      ]);
    });
  });

  describe('resourcesToStrings', () => {
    it('converts a resource to a string', () => {
      expect(
        resourcesToStrings([
          {
            metricNamespace: 'Microsoft.Sql/servers/databases',
            resourceGroup: 'cloud-datasources',
            resourceName: 'foo/bar',
            subscription: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            region: 'useast',
          },
        ])
      ).toEqual([
        '/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.Sql/servers/foo/databases/bar',
      ]);
    });
  });
});
