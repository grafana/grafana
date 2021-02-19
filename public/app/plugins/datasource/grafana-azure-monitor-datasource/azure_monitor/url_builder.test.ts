import UrlBuilder from './url_builder';

describe('AzureMonitorUrlBuilder', () => {
  describe('when metric definition is Microsoft.Sql/servers/databases', () => {
    it('should build the getMetricNames url in the longer format', () => {
      const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
        '',
        'sub1',
        'rg',
        'Microsoft.Sql/servers/databases',
        'rn1/rn2',
        'default',
        '2017-05-01-preview'
      );
      expect(url).toBe(
        '/sub1/resourceGroups/rg/providers/Microsoft.Sql/servers/rn1/databases/rn2/' +
          'providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=default'
      );
    });
  });

  describe('when metric definition is Microsoft.Sql/servers', () => {
    it('should build the getMetricNames url in the shorter format', () => {
      const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
        '',
        'sub1',
        'rg',
        'Microsoft.Sql/servers',
        'rn',
        'default',
        '2017-05-01-preview'
      );
      expect(url).toBe(
        '/sub1/resourceGroups/rg/providers/Microsoft.Sql/servers/rn/' +
          'providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=default'
      );
    });
  });

  describe('when metric definition is Microsoft.Storage/storageAccounts/blobServices', () => {
    it('should build the getMetricNames url in the longer format', () => {
      const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
        '',
        'sub1',
        'rg',
        'Microsoft.Storage/storageAccounts/blobServices',
        'rn1/default',
        'default',
        '2017-05-01-preview'
      );
      expect(url).toBe(
        '/sub1/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/rn1/blobServices/default/' +
          'providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=default'
      );
    });
  });

  describe('when metric definition is Microsoft.Storage/storageAccounts/fileServices', () => {
    it('should build the getMetricNames url in the longer format', () => {
      const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
        '',
        'sub1',
        'rg',
        'Microsoft.Storage/storageAccounts/fileServices',
        'rn1/default',
        'default',
        '2017-05-01-preview'
      );
      expect(url).toBe(
        '/sub1/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/rn1/fileServices/default/' +
          'providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=default'
      );
    });
  });

  describe('when metric definition is Microsoft.Storage/storageAccounts/tableServices', () => {
    it('should build the getMetricNames url in the longer format', () => {
      const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
        '',
        'sub1',
        'rg',
        'Microsoft.Storage/storageAccounts/tableServices',
        'rn1/default',
        'default',
        '2017-05-01-preview'
      );
      expect(url).toBe(
        '/sub1/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/rn1/tableServices/default/' +
          'providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=default'
      );
    });
  });

  describe('when metric definition is Microsoft.Storage/storageAccounts/queueServices', () => {
    it('should build the getMetricNames url in the longer format', () => {
      const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
        '',
        'sub1',
        'rg',
        'Microsoft.Storage/storageAccounts/queueServices',
        'rn1/default',
        'default',
        '2017-05-01-preview'
      );
      expect(url).toBe(
        '/sub1/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/rn1/queueServices/default/' +
          'providers/microsoft.insights/metricdefinitions?api-version=2017-05-01-preview&metricnamespace=default'
      );
    });
  });
});
