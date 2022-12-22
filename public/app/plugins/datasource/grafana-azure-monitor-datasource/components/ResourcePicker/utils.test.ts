import createMockQuery from '../../__mocks__/query';

import { ResourceRowGroup, ResourceRowType } from './types';
import { findRow, parseResourceURI, setResource } from './utils';

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

  describe('setResource', () => {
    it('updates a resource with a resource URI for Log Analytics', () => {
      expect(setResource(createMockQuery(), '/subscription/sub')).toMatchObject({
        azureLogAnalytics: { resource: '/subscription/sub' },
      });
    });

    it('updates a resource with a resource parameters for Metrics', () => {
      expect(
        setResource(createMockQuery(), {
          subscription: 'sub',
          resourceGroup: 'rg',
          metricNamespace: 'Microsoft.Storage/storageAccounts',
          resourceName: 'testacct',
        })
      ).toMatchObject({
        subscription: 'sub',
        azureMonitor: {
          aggregation: undefined,
          metricName: undefined,
          metricNamespace: 'microsoft.storage/storageaccounts',
          resourceGroup: 'rg',
          resourceName: 'testacct',
        },
      });
    });
  });
});
