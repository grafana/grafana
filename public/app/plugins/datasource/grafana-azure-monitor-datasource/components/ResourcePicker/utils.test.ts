import createMockQuery from '../../__mocks__/query';

import { ResourceRowGroup, ResourceRowType } from './types';
import { findRow, parseResourceURI, setResource } from './utils';

describe('AzureMonitor ResourcePicker utils', () => {
  describe('parseResourceURI', () => {
    it('should parse subscription URIs', () => {
      expect(parseResourceURI('/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572')).toEqual({
        subscription: '44693801-6ee6-49de-9b2d-9106972f9572',
      });
    });

    it('should parse resource group URIs', () => {
      expect(
        parseResourceURI('/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources')
      ).toEqual({
        subscription: '44693801-6ee6-49de-9b2d-9106972f9572',
        resourceGroup: 'cloud-datasources',
      });
    });

    it('should parse resource URIs', () => {
      expect(
        parseResourceURI(
          '/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources/providers/Microsoft.Compute/virtualMachines/GithubTestDataVM'
        )
      ).toEqual({
        subscription: '44693801-6ee6-49de-9b2d-9106972f9572',
        resourceGroup: 'cloud-datasources',
        metricNamespace: 'Microsoft.Compute/virtualMachines',
        resourceName: 'GithubTestDataVM',
      });
    });

    it('should parse resource URIs with a subresource', () => {
      expect(
        parseResourceURI(
          '/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources/providers/Microsoft.Storage/storageAccounts/csb100320016c43d2d0/fileServices/default'
        )
      ).toEqual({
        subscription: '44693801-6ee6-49de-9b2d-9106972f9572',
        resourceGroup: 'cloud-datasources',
        metricNamespace: 'Microsoft.Storage/storageAccounts/fileServices',
        resourceName: 'csb100320016c43d2d0/default',
      });
    });

    it('returns undefined for invalid input', () => {
      expect(parseResourceURI('44693801-6ee6-49de-9b2d-9106972f9572')).toEqual({});
    });

    it('returns a valid response with a missing element in the metric namespace and name', () => {
      expect(
        parseResourceURI(
          '/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources/providers/foo'
        )
      ).toEqual({
        metricNamespace: 'foo',
        resourceGroup: 'cloud-datasources',
        resourceName: '',
        subscription: '44693801-6ee6-49de-9b2d-9106972f9572',
      });

      expect(
        parseResourceURI(
          '/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources/providers/foo/bar'
        )
      ).toEqual({
        metricNamespace: 'foo/bar',
        resourceGroup: 'cloud-datasources',
        resourceName: '',
        subscription: '44693801-6ee6-49de-9b2d-9106972f9572',
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
          uri: '/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources/providers/Microsoft.Storage/storageAccounts/csb100320016c43d2d0',
          name: '',
          type: ResourceRowType.Resource,
          typeLabel: '',
        },
      ];
      expect(
        findRow(
          rows,
          '/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources/providers/Microsoft.Storage/storageAccounts/csb100320016c43d2d0/fileServices/default'
        )
      ).toEqual(rows[0]);
    });

    it('should find a row ignoring a metric namespace case', () => {
      const rows: ResourceRowGroup = [
        {
          id: '',
          uri: '/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources/providers/microsoft.storage/storageaccounts/csb100320016c43d2d0',
          name: '',
          type: ResourceRowType.Resource,
          typeLabel: '',
        },
      ];
      expect(
        findRow(
          rows,
          '/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources/providers/Microsoft.Storage/storageAccounts/csb100320016c43d2d0'
        )
      ).toEqual(rows[0]);
    });

    it('should find a row ignoring a resource group case', () => {
      const rows: ResourceRowGroup = [
        {
          id: '',
          uri: '/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/CLOUD-DATASOURCES/providers/microsoft.storage/storageaccounts/csb100320016c43d2d0',
          name: '',
          type: ResourceRowType.Resource,
          typeLabel: '',
        },
      ];
      expect(
        findRow(
          rows,
          '/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources/providers/Microsoft.Storage/storageAccounts/csb100320016c43d2d0'
        )
      ).toEqual(rows[0]);
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
