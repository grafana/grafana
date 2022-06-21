import UrlBuilder from './url_builder';

describe('AzureMonitorUrlBuilder', () => {
  describe('buildResourceUri', () => {
    it('builds a resource uri when the required properties are provided', () => {
      expect(UrlBuilder.buildResourceUri('sub', 'group', 'Microsoft.NetApp/netAppAccounts', 'name')).toEqual(
        '/subscriptions/sub/resourceGroups/group/providers/Microsoft.NetApp/netAppAccounts/name'
      );
    });
  });

  describe('when a resource uri is provided', () => {
    it('builds a getMetricNamesnamespace url', () => {
      const url = UrlBuilder.buildAzureMonitorGetMetricNamespacesUrl('', '2017-05-01-preview', {
        resourceUri: '/subscriptions/sub/resource-uri/resource',
      });
      expect(url).toBe(
        '/subscriptions/sub/resource-uri/resource/providers/microsoft.insights/metricNamespaces?api-version=2017-05-01-preview'
      );
    });
  });

  describe('when a resource uri and metric namespace is provided', () => {
    it('builds a getMetricNames url', () => {
      const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl('', '2017-05-01-preview', {
        resourceUri: '/subscriptions/sub/resource-uri/resource',
        metricNamespace: 'Microsoft.Sql/servers',
      });
      expect(url).toBe(
        '/subscriptions/sub/resource-uri/resource/providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=Microsoft.Sql%2Fservers'
      );
    });
  });

  describe('Legacy query object', () => {
    describe('when metric definition is Microsoft.NetApp/netAppAccounts/capacityPools/volumes', () => {
      it('should build the getMetricNamespaces url in the even longer format', () => {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamespacesUrl('', '2017-05-01-preview', {
          subscription: 'sub1',
          resourceGroup: 'rg',
          metricDefinition: 'Microsoft.NetApp/netAppAccounts/capacityPools/volumes',
          resourceName: 'rn1/rn2/rn3',
        });
        expect(url).toBe(
          '/subscriptions/sub1/resourceGroups/rg/providers/Microsoft.NetApp/netAppAccounts/rn1/capacityPools/rn2/volumes/rn3/' +
            'providers/microsoft.insights/metricNamespaces?api-version=2017-05-01-preview'
        );
      });
    });

    describe('when metric definition is Microsoft.Sql/servers/databases', () => {
      it('should build the getMetricNamespaces url in the longer format', () => {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamespacesUrl('', '2017-05-01-preview', {
          subscription: 'sub1',
          resourceGroup: 'rg',
          metricDefinition: 'Microsoft.Sql/servers/databases',
          resourceName: 'rn1/rn2',
        });
        expect(url).toBe(
          '/subscriptions/sub1/resourceGroups/rg/providers/Microsoft.Sql/servers/rn1/databases/rn2/' +
            'providers/microsoft.insights/metricNamespaces?api-version=2017-05-01-preview'
        );
      });
    });

    describe('when metric definition is Microsoft.Sql/servers', () => {
      it('should build the getMetricNamespaces url in the shorter format', () => {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamespacesUrl('', '2017-05-01-preview', {
          subscription: 'sub1',
          resourceGroup: 'rg',
          metricDefinition: 'Microsoft.Sql/servers',
          resourceName: 'rn',
        });
        expect(url).toBe(
          '/subscriptions/sub1/resourceGroups/rg/providers/Microsoft.Sql/servers/rn/' +
            'providers/microsoft.insights/metricNamespaces?api-version=2017-05-01-preview'
        );
      });
    });

    describe('when metric definition is Microsoft.NetApp/netAppAccounts/capacityPools/volumes and the metricNamespace is default', () => {
      it('should build the getMetricNames url in the even longer format', () => {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl('', '2017-05-01-preview', {
          subscription: 'sub1',
          resourceGroup: 'rg',
          metricDefinition: 'Microsoft.NetApp/netAppAccounts/capacityPools/volumes',
          resourceName: 'rn1/rn2/rn3',
          metricNamespace: 'default',
        });
        expect(url).toBe(
          '/subscriptions/sub1/resourceGroups/rg/providers/Microsoft.NetApp/netAppAccounts/rn1/capacityPools/rn2/volumes/rn3/' +
            'providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=default'
        );
      });
    });

    describe('when metric definition is Microsoft.Sql/servers/databases and the metricNamespace is default', () => {
      it('should build the getMetricNames url in the longer format', () => {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl('', '2017-05-01-preview', {
          subscription: 'sub1',
          resourceGroup: 'rg',
          metricDefinition: 'Microsoft.Sql/servers/databases',
          resourceName: 'rn1/rn2',
          metricNamespace: 'default',
        });
        expect(url).toBe(
          '/subscriptions/sub1/resourceGroups/rg/providers/Microsoft.Sql/servers/rn1/databases/rn2/' +
            'providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=default'
        );
      });
    });

    describe('when metric definition is Microsoft.Sql/servers and the metricNamespace is default', () => {
      it('should build the getMetricNames url in the shorter format', () => {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl('', '2017-05-01-preview', {
          subscription: 'sub1',
          resourceGroup: 'rg',
          metricDefinition: 'Microsoft.Sql/servers',
          resourceName: 'rn',
          metricNamespace: 'default',
        });
        expect(url).toBe(
          '/subscriptions/sub1/resourceGroups/rg/providers/Microsoft.Sql/servers/rn/' +
            'providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=default'
        );
      });
    });

    describe('when metric definition is Microsoft.Storage/storageAccounts/blobServices and the metricNamespace is default', () => {
      it('should build the getMetricNames url in the longer format', () => {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl('', '2017-05-01-preview', {
          subscription: 'sub1',
          resourceGroup: 'rg',
          metricDefinition: 'Microsoft.Storage/storageAccounts/blobServices',
          resourceName: 'rn1/default',
          metricNamespace: 'default',
        });
        expect(url).toBe(
          '/subscriptions/sub1/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/rn1/blobServices/default/' +
            'providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=default'
        );
      });
    });

    describe('when metric definition is Microsoft.Storage/storageAccounts/fileServices and the metricNamespace is default', () => {
      it('should build the getMetricNames url in the longer format', () => {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl('', '2017-05-01-preview', {
          subscription: 'sub1',
          resourceGroup: 'rg',
          metricDefinition: 'Microsoft.Storage/storageAccounts/fileServices',
          resourceName: 'rn1/default',
          metricNamespace: 'default',
        });
        expect(url).toBe(
          '/subscriptions/sub1/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/rn1/fileServices/default/' +
            'providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=default'
        );
      });
    });

    describe('when metric definition is Microsoft.Storage/storageAccounts/tableServices and the metricNamespace is default', () => {
      it('should build the getMetricNames url in the longer format', () => {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl('', '2017-05-01-preview', {
          subscription: 'sub1',
          resourceGroup: 'rg',
          metricDefinition: 'Microsoft.Storage/storageAccounts/tableServices',
          resourceName: 'rn1/default',
          metricNamespace: 'default',
        });
        expect(url).toBe(
          '/subscriptions/sub1/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/rn1/tableServices/default/' +
            'providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=default'
        );
      });
    });

    describe('when metric definition is Microsoft.Storage/storageAccounts/queueServices and the metricNamespace is default', () => {
      it('should build the getMetricNames url in the longer format', () => {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl('', '2017-05-01-preview', {
          subscription: 'sub1',
          resourceGroup: 'rg',
          metricDefinition: 'Microsoft.Storage/storageAccounts/queueServices',
          resourceName: 'rn1/default',
          metricNamespace: 'default',
        });
        expect(url).toBe(
          '/subscriptions/sub1/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/rn1/queueServices/default/' +
            'providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=default'
        );
      });
    });
  });
});
