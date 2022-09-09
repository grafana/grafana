import { getTemplateSrv } from '@grafana/runtime';

import UrlBuilder from './url_builder';

let replaceMock = jest.fn().mockImplementation((s: string) => s);

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  return {
    ...original,
    getTemplateSrv: () => ({
      replace: replaceMock,
    }),
  };
});

describe('AzureMonitorUrlBuilder', () => {
  let templateSrv = getTemplateSrv();
  describe('buildResourceUri', () => {
    it('builds a resource uri when the required properties are provided', () => {
      expect(
        UrlBuilder.buildResourceUri(templateSrv, {
          subscription: 'sub',
          resourceGroup: 'group',
          metricNamespace: 'Microsoft.NetApp/netAppAccounts',
          resourceName: 'name',
        })
      ).toEqual('/subscriptions/sub/resourceGroups/group/providers/Microsoft.NetApp/netAppAccounts/name');
    });

    it('builds a resource uri correctly when a template variable is used as namespace', () => {
      expect(
        UrlBuilder.buildResourceUri(templateSrv, {
          subscription: 'sub',
          resourceGroup: 'group',
          metricNamespace: '$ns',
          resourceName: 'name',
        })
      ).toEqual('/subscriptions/sub/resourceGroups/group/providers/$ns/name');
    });

    it('builds a resource uri correctly when the namespace includes a storage sub-resource', () => {
      expect(
        UrlBuilder.buildResourceUri(templateSrv, {
          subscription: 'sub',
          resourceGroup: 'group',
          metricNamespace: 'Microsoft.Storage/storageAccounts/tableServices',
          resourceName: 'name',
        })
      ).toEqual(
        '/subscriptions/sub/resourceGroups/group/providers/Microsoft.Storage/storageAccounts/name/tableServices/default'
      );
    });

    describe('when using template variables', () => {
      replaceMock = jest
        .fn()
        .mockImplementation((s: string) =>
          s
            .replace('$ns', 'Microsoft.Storage/storageAccounts')
            .replace('$ns2', 'tableServices')
            .replace('$rs', 'name')
            .replace('$rs2', 'default')
        );
      templateSrv = getTemplateSrv();

      it('builds a resource uri without specifying a subresource (default)', () => {
        expect(
          UrlBuilder.buildResourceUri(templateSrv, {
            subscription: 'sub',
            resourceGroup: 'group',
            metricNamespace: '$ns/tableServices',
            resourceName: 'name',
          })
        ).toEqual('/subscriptions/sub/resourceGroups/group/providers/$ns/name/tableServices/default');
      });

      it('builds a resource uri specifying a subresource (default)', () => {
        expect(
          UrlBuilder.buildResourceUri(templateSrv, {
            subscription: 'sub',
            resourceGroup: 'group',
            metricNamespace: '$ns/tableServices',
            resourceName: 'name/default',
          })
        ).toEqual('/subscriptions/sub/resourceGroups/group/providers/$ns/name/tableServices/default');
      });

      it('builds a resource uri specifying a resource template variable', () => {
        expect(
          UrlBuilder.buildResourceUri(templateSrv, {
            subscription: 'sub',
            resourceGroup: 'group',
            metricNamespace: '$ns/tableServices',
            resourceName: '$rs/default',
          })
        ).toEqual('/subscriptions/sub/resourceGroups/group/providers/$ns/$rs/tableServices/default');
      });

      it('builds a resource uri specifying multiple template variables', () => {
        expect(
          UrlBuilder.buildResourceUri(templateSrv, {
            subscription: 'sub',
            resourceGroup: 'group',
            metricNamespace: '$ns/$ns2',
            resourceName: '$rs/$rs2',
          })
        ).toEqual('/subscriptions/sub/resourceGroups/group/providers/$ns/$rs/$ns2/$rs2');
      });

      it('builds a resource uri with only a subscription', () => {
        expect(
          UrlBuilder.buildResourceUri(templateSrv, {
            subscription: 'sub',
          })
        ).toEqual('/subscriptions/sub');
      });

      it('builds a resource uri with a subscription and a resource group', () => {
        expect(
          UrlBuilder.buildResourceUri(templateSrv, {
            subscription: 'sub',
            resourceGroup: 'group',
          })
        ).toEqual('/subscriptions/sub/resourceGroups/group');
      });
    });
  });

  describe('when a resource uri is provided', () => {
    it('builds a getMetricNamesnamespace url', () => {
      const url = UrlBuilder.buildAzureMonitorGetMetricNamespacesUrl(
        '',
        '2017-05-01-preview',
        {
          resourceUri: '/subscriptions/sub/resource-uri/resource',
        },
        true,
        templateSrv
      );
      expect(url).toBe(
        '/subscriptions/sub/resource-uri/resource/providers/microsoft.insights/metricNamespaces?api-version=2017-05-01-preview&region=global'
      );
    });
  });

  describe('when a resource uri and metric namespace is provided', () => {
    it('builds a getMetricNames url', () => {
      const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
        '',
        '2017-05-01-preview',
        {
          resourceUri: '/subscriptions/sub/resource-uri/resource',
          metricNamespace: 'Microsoft.Sql/servers',
        },
        templateSrv
      );
      expect(url).toBe(
        '/subscriptions/sub/resource-uri/resource/providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=Microsoft.Sql%2Fservers'
      );
    });
  });

  describe('Legacy query object', () => {
    describe('when metric definition is Microsoft.NetApp/netAppAccounts/capacityPools/volumes', () => {
      it('should build the getMetricNamespaces url in the even longer format', () => {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamespacesUrl(
          '',
          '2017-05-01-preview',
          {
            subscription: 'sub1',
            resourceGroup: 'rg',
            metricNamespace: 'Microsoft.NetApp/netAppAccounts/capacityPools/volumes',
            resourceName: 'rn1/rn2/rn3',
          },
          true,
          templateSrv
        );
        expect(url).toBe(
          '/subscriptions/sub1/resourceGroups/rg/providers/Microsoft.NetApp/netAppAccounts/rn1/capacityPools/rn2/volumes/rn3/' +
            'providers/microsoft.insights/metricNamespaces?api-version=2017-05-01-preview&region=global'
        );
      });
    });

    describe('when metric definition is Microsoft.Sql/servers/databases', () => {
      it('should build the getMetricNamespaces url in the longer format', () => {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamespacesUrl(
          '',
          '2017-05-01-preview',
          {
            subscription: 'sub1',
            resourceGroup: 'rg',
            metricNamespace: 'Microsoft.Sql/servers/databases',
            resourceName: 'rn1/rn2',
          },
          true,
          templateSrv
        );
        expect(url).toBe(
          '/subscriptions/sub1/resourceGroups/rg/providers/Microsoft.Sql/servers/rn1/databases/rn2/' +
            'providers/microsoft.insights/metricNamespaces?api-version=2017-05-01-preview&region=global'
        );
      });

      it('should omit global region if specified', () => {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamespacesUrl(
          '',
          '2017-05-01-preview',
          {
            subscription: 'sub1',
            resourceGroup: 'rg',
            metricNamespace: 'Microsoft.Sql/servers/databases',
            resourceName: 'rn1/rn2',
          },
          false,
          templateSrv
        );
        expect(url).toBe(
          '/subscriptions/sub1/resourceGroups/rg/providers/Microsoft.Sql/servers/rn1/databases/rn2/' +
            'providers/microsoft.insights/metricNamespaces?api-version=2017-05-01-preview'
        );
      });
    });

    describe('when metric definition is Microsoft.Sql/servers', () => {
      it('should build the getMetricNamespaces url in the shorter format', () => {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamespacesUrl(
          '',
          '2017-05-01-preview',
          {
            subscription: 'sub1',
            resourceGroup: 'rg',
            metricNamespace: 'Microsoft.Sql/servers',
            resourceName: 'rn',
          },
          true,
          templateSrv
        );
        expect(url).toBe(
          '/subscriptions/sub1/resourceGroups/rg/providers/Microsoft.Sql/servers/rn/' +
            'providers/microsoft.insights/metricNamespaces?api-version=2017-05-01-preview&region=global'
        );
      });
    });

    describe('when metric definition is Microsoft.NetApp/netAppAccounts/capacityPools/volumes and the metricNamespace', () => {
      it('should build the getMetricNames url in the even longer format', () => {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
          '',
          '2017-05-01-preview',
          {
            subscription: 'sub1',
            resourceGroup: 'rg',
            metricNamespace: 'Microsoft.NetApp/netAppAccounts/capacityPools/volumes',
            resourceName: 'rn1/rn2/rn3',
          },
          templateSrv
        );
        expect(url).toBe(
          '/subscriptions/sub1/resourceGroups/rg/providers/Microsoft.NetApp/netAppAccounts/rn1/capacityPools/rn2/volumes/rn3/' +
            'providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=Microsoft.NetApp%2FnetAppAccounts%2FcapacityPools%2Fvolumes'
        );
      });
    });

    describe('when metric definition is Microsoft.Sql/servers/databases and the metricNamespace', () => {
      it('should build the getMetricNames url in the longer format', () => {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
          '',
          '2017-05-01-preview',
          {
            subscription: 'sub1',
            resourceGroup: 'rg',
            metricNamespace: 'Microsoft.Sql/servers/databases',
            resourceName: 'rn1/rn2',
          },
          templateSrv
        );
        expect(url).toBe(
          '/subscriptions/sub1/resourceGroups/rg/providers/Microsoft.Sql/servers/rn1/databases/rn2/' +
            'providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=Microsoft.Sql%2Fservers%2Fdatabases'
        );
      });
    });

    describe('when metric definition is Microsoft.Sql/servers and the metricNamespace', () => {
      it('should build the getMetricNames url in the shorter format', () => {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
          '',
          '2017-05-01-preview',
          {
            subscription: 'sub1',
            resourceGroup: 'rg',
            metricNamespace: 'Microsoft.Sql/servers',
            resourceName: 'rn',
          },
          templateSrv
        );
        expect(url).toBe(
          '/subscriptions/sub1/resourceGroups/rg/providers/Microsoft.Sql/servers/rn/' +
            'providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=Microsoft.Sql%2Fservers'
        );
      });
    });

    describe('when metric definition is Microsoft.Storage/storageAccounts/blobServices and the metricNamespace', () => {
      it('should build the getMetricNames url in the longer format', () => {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
          '',
          '2017-05-01-preview',
          {
            subscription: 'sub1',
            resourceGroup: 'rg',
            metricNamespace: 'Microsoft.Storage/storageAccounts/blobServices',
            resourceName: 'rn1/default',
          },
          templateSrv
        );
        expect(url).toBe(
          '/subscriptions/sub1/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/rn1/blobServices/default/' +
            'providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=Microsoft.Storage%2FstorageAccounts%2FblobServices'
        );
      });
    });

    describe('when metric definition is Microsoft.Storage/storageAccounts/fileServices and the metricNamespace', () => {
      it('should build the getMetricNames url in the longer format', () => {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
          '',
          '2017-05-01-preview',
          {
            subscription: 'sub1',
            resourceGroup: 'rg',
            metricNamespace: 'Microsoft.Storage/storageAccounts/fileServices',
            resourceName: 'rn1/default',
          },
          templateSrv
        );
        expect(url).toBe(
          '/subscriptions/sub1/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/rn1/fileServices/default/' +
            'providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=Microsoft.Storage%2FstorageAccounts%2FfileServices'
        );
      });
    });

    describe('when metric definition is Microsoft.Storage/storageAccounts/tableServices and the metricNamespace', () => {
      it('should build the getMetricNames url in the longer format', () => {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
          '',
          '2017-05-01-preview',
          {
            subscription: 'sub1',
            resourceGroup: 'rg',
            metricNamespace: 'Microsoft.Storage/storageAccounts/tableServices',
            resourceName: 'rn1/default',
          },
          templateSrv
        );
        expect(url).toBe(
          '/subscriptions/sub1/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/rn1/tableServices/default/' +
            'providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=Microsoft.Storage%2FstorageAccounts%2FtableServices'
        );
      });
    });

    describe('when metric definition is Microsoft.Storage/storageAccounts/queueServices and the metricNamespace', () => {
      it('should build the getMetricNames url in the longer format', () => {
        const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
          '',
          '2017-05-01-preview',
          {
            subscription: 'sub1',
            resourceGroup: 'rg',
            metricNamespace: 'Microsoft.Storage/storageAccounts/queueServices',
            resourceName: 'rn1/default',
          },
          templateSrv
        );
        expect(url).toBe(
          '/subscriptions/sub1/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/rn1/queueServices/default/' +
            'providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=Microsoft.Storage%2FstorageAccounts%2FqueueServices'
        );
      });
    });
  });
});
