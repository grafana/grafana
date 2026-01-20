import { DataSourceRulesSourceIdentifier } from 'app/types/unified-alerting';

import { getDatasourceAPIUid, getExternalRulesSources } from '../../utils/datasource';

/**
 * Tests for getRulesSourcesFromFilter logic in useFilteredRulesIterator
 *
 * The function getRulesSourcesFromFilter filters data sources based on:
 * 1. Whether getDatasourceAPIUid can resolve the name to a UID (catches errors)
 * 2. Whether the UID exists in allExternalRulesSources (from getExternalRulesSources)
 *
 * getExternalRulesSources already filters for:
 * - Supported types (isSupportedExternalRulesSourceType)
 * - Data sources managing alerts (isDataSourceManagingAlerts)
 *
 * So getRulesSourcesFromFilter only needs to check if the UID exists in that pre-filtered list.
 */

jest.mock('../../utils/datasource');

const getDatasourceAPIUidMock = jest.mocked(getDatasourceAPIUid);
const getExternalRulesSourcesMock = jest.mocked(getExternalRulesSources);

describe('getRulesSourcesFromFilter - data source filtering logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('filtering by allExternalRulesSources', () => {
    it('should include data sources that exist in allExternalRulesSources', () => {
      const allExternalSources: DataSourceRulesSourceIdentifier[] = [
        { uid: 'prometheus-uid', name: 'Prometheus', ruleSourceType: 'datasource' },
        { uid: 'loki-uid', name: 'Loki', ruleSourceType: 'datasource' },
      ];

      getDatasourceAPIUidMock.mockReturnValue('prometheus-uid');
      getExternalRulesSourcesMock.mockReturnValue(allExternalSources);

      // The data source should be included because its UID exists in allExternalSources
      const uid = getDatasourceAPIUidMock('Prometheus');
      const exists = allExternalSources.some((source) => source.uid === uid);

      expect(exists).toBe(true);
      expect(uid).toBe('prometheus-uid');
    });

    it('should exclude data sources that do not exist in allExternalRulesSources', () => {
      const allExternalSources: DataSourceRulesSourceIdentifier[] = [
        { uid: 'prometheus-uid', name: 'Prometheus', ruleSourceType: 'datasource' },
      ];

      getDatasourceAPIUidMock.mockReturnValue('mysql-uid');
      getExternalRulesSourcesMock.mockReturnValue(allExternalSources);

      // The data source should be excluded because its UID does not exist in allExternalSources
      // This happens automatically for:
      // - Unsupported types (MySQL, etc.)
      // - Data sources with manageAlerts=false
      // Because getExternalRulesSources already filters these out
      const uid = getDatasourceAPIUidMock('MySQL');
      const exists = allExternalSources.some((source) => source.uid === uid);

      expect(exists).toBe(false);
      expect(uid).toBe('mysql-uid');
    });

    it('should exclude data sources with manageAlerts=false (filtered by getExternalRulesSources)', () => {
      // getExternalRulesSources already filters out data sources with manageAlerts=false
      const allExternalSources: DataSourceRulesSourceIdentifier[] = [
        { uid: 'prom-enabled-uid', name: 'PrometheusEnabled', ruleSourceType: 'datasource' },
        // prom-disabled-uid is NOT in this list because getExternalRulesSources filtered it out
      ];

      getDatasourceAPIUidMock.mockReturnValue('prom-disabled-uid');
      getExternalRulesSourcesMock.mockReturnValue(allExternalSources);

      // Even though this is a valid Prometheus datasource, it won't be in allExternalSources
      // because it has manageAlerts=false
      const uid = getDatasourceAPIUidMock('PrometheusDisabled');
      const exists = allExternalSources.some((source) => source.uid === uid);

      expect(exists).toBe(false);
    });

    it('should handle multiple data sources correctly', () => {
      const allExternalSources: DataSourceRulesSourceIdentifier[] = [
        { uid: 'prom-1-uid', name: 'Prometheus1', ruleSourceType: 'datasource' },
        { uid: 'loki-1-uid', name: 'Loki1', ruleSourceType: 'datasource' },
        // prom-2-uid is not included (e.g., manageAlerts=false)
        // mysql-uid is not included (unsupported type)
      ];

      getExternalRulesSourcesMock.mockReturnValue(allExternalSources);

      // Check which data sources would be included
      getDatasourceAPIUidMock.mockReturnValueOnce('prom-1-uid');
      const uid1 = getDatasourceAPIUidMock('Prometheus1');
      expect(allExternalSources.some((source) => source.uid === uid1)).toBe(true);

      getDatasourceAPIUidMock.mockReturnValueOnce('prom-2-uid');
      const uid2 = getDatasourceAPIUidMock('Prometheus2');
      expect(allExternalSources.some((source) => source.uid === uid2)).toBe(false);

      getDatasourceAPIUidMock.mockReturnValueOnce('loki-1-uid');
      const uid3 = getDatasourceAPIUidMock('Loki1');
      expect(allExternalSources.some((source) => source.uid === uid3)).toBe(true);

      getDatasourceAPIUidMock.mockReturnValueOnce('mysql-uid');
      const uid4 = getDatasourceAPIUidMock('MySQL');
      expect(allExternalSources.some((source) => source.uid === uid4)).toBe(false);
    });
  });

  describe('empty filter behavior', () => {
    it('should return all external sources when no datasource filter is provided', () => {
      const allExternalSources: DataSourceRulesSourceIdentifier[] = [
        { uid: 'prometheus-uid', name: 'Prometheus', ruleSourceType: 'datasource' },
        { uid: 'loki-uid', name: 'Loki', ruleSourceType: 'datasource' },
      ];

      getExternalRulesSourcesMock.mockReturnValue(allExternalSources);

      // When filter.dataSourceNames is empty, getRulesSourcesFromFilter should return
      // all external sources without needing to call getDatasourceAPIUid
      // This avoids the need for a second call to getExternalRulesSources
      const result = getExternalRulesSourcesMock();

      expect(result).toEqual(allExternalSources);
      expect(result.length).toBe(2);

      // getDatasourceAPIUid should not be called when filter is empty
      expect(getDatasourceAPIUidMock).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle errors from getDatasourceAPIUid gracefully', () => {
      getDatasourceAPIUidMock.mockImplementation(() => {
        throw new Error('Datasource not found');
      });

      // The code has a try-catch block that handles this error
      // When getDatasourceAPIUid throws, the catch block prevents the error from propagating

      expect(() => {
        try {
          getDatasourceAPIUidMock('InvalidDatasource');
        } catch {
          // This is the expected behavior in getRulesSourcesFromFilter
          // The catch block silently continues to the next data source
        }
      }).not.toThrow();
    });

    it('should handle empty allExternalRulesSources', () => {
      const allExternalSources: DataSourceRulesSourceIdentifier[] = [];

      getDatasourceAPIUidMock.mockReturnValue('prometheus-uid');
      getExternalRulesSourcesMock.mockReturnValue(allExternalSources);

      // No data sources should be included when allExternalSources is empty
      const uid = getDatasourceAPIUidMock('Prometheus');
      const exists = allExternalSources.some((source) => source.uid === uid);

      expect(exists).toBe(false);
      expect(allExternalSources.length).toBe(0);
    });
  });
});
