import config from 'app/core/config';

import { getAllMeasurements, getAllPolicies, getFieldKeys, getTagKeys, getTagValues } from './influxql_metadata_query';
import { getMockInfluxDS } from './mocks/datasource';
import { InfluxQuery, InfluxVariableQuery } from './types';

describe('influx_metadata_query', () => {
  let query: InfluxVariableQuery;
  let target: InfluxQuery;
  const mockMetricFindQuery = jest.fn();
  const mockRunMetadataQuery = jest.fn();
  mockMetricFindQuery.mockImplementation((q: InfluxVariableQuery) => {
    query = q;
    return Promise.resolve([]);
  });
  mockRunMetadataQuery.mockImplementation((t: InfluxVariableQuery) => {
    target = t;
    query = t;
    return Promise.resolve([]);
  });

  const ds = getMockInfluxDS();
  ds.metricFindQuery = mockMetricFindQuery;
  ds.runMetadataQuery = mockRunMetadataQuery;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // This should be removed when backend mode is default
  describe('backend mode disabled', () => {
    beforeEach(() => {
      config.featureToggles.influxdbBackendMigration = false;
    });

    function frontendModeChecks() {
      expect(mockRunMetadataQuery).not.toHaveBeenCalled();
      expect(mockMetricFindQuery).toHaveBeenCalled();
    }

    describe('getAllPolicies', () => {
      it('should call metricFindQuery with SHOW RETENTION POLICIES', () => {
        getAllPolicies(ds);
        frontendModeChecks();
        expect(query.query).toMatch('SHOW RETENTION POLICIES');
      });
    });

    describe('getAllMeasurements', () => {
      it('no tags specified', () => {
        getAllMeasurements(ds, []);
        frontendModeChecks();
        expect(query.query).toBe('SHOW MEASUREMENTS LIMIT 100');
      });

      it('with tags', () => {
        getAllMeasurements(ds, [{ key: 'key', value: 'val' }]);
        frontendModeChecks();
        expect(query.query).toMatch('SHOW MEASUREMENTS WHERE "key"');
      });

      it('with measurement filter', () => {
        getAllMeasurements(ds, [{ key: 'key', value: 'val' }], 'measurementFilter');
        frontendModeChecks();
        expect(query.query).toMatch('SHOW MEASUREMENTS WITH MEASUREMENT =~ /(?i)measurementFilter/ WHERE "key"');
      });
    });

    describe('getTagKeys', () => {
      it('no tags specified', () => {
        getTagKeys(ds);
        frontendModeChecks();
        expect(query.query).toBe('SHOW TAG KEYS');
      });

      it('with measurement', () => {
        getTagKeys(ds, 'test_measurement');
        frontendModeChecks();
        expect(query.query).toBe('SHOW TAG KEYS FROM "test_measurement"');
      });

      it('with retention policy', () => {
        getTagKeys(ds, 'test_measurement', 'rp');
        frontendModeChecks();
        expect(query.query).toBe('SHOW TAG KEYS FROM "rp"."test_measurement"');
      });
    });

    describe('getTagValues', () => {
      it('with key', () => {
        getTagValues(ds, [], 'test_key');
        frontendModeChecks();
        expect(query.query).toBe('SHOW TAG VALUES WITH KEY = "test_key"');
      });

      it('with key ends with ::tag', () => {
        getTagValues(ds, [], 'test_key::tag');
        frontendModeChecks();
        expect(query.query).toBe('SHOW TAG VALUES WITH KEY = "test_key"');
      });

      it('with key ends with ::field', async () => {
        const result = await getTagValues(ds, [], 'test_key::field');
        expect(result.length).toBe(0);
      });

      it('with tags', () => {
        getTagValues(ds, [{ key: 'tagKey', value: 'tag_val' }], 'test_key');
        frontendModeChecks();
        expect(query.query).toBe('SHOW TAG VALUES WITH KEY = "test_key" WHERE "tagKey" = \'tag_val\'');
      });

      it('with measurement', () => {
        getTagValues(ds, [{ key: 'tagKey', value: 'tag_val' }], 'test_key', 'test_measurement');
        frontendModeChecks();
        expect(query.query).toBe(
          'SHOW TAG VALUES FROM "test_measurement" WITH KEY = "test_key" WHERE "tagKey" = \'tag_val\''
        );
      });

      it('with retention policy', () => {
        getTagValues(ds, [{ key: 'tagKey', value: 'tag_val' }], 'test_key', 'test_measurement', 'rp');
        frontendModeChecks();
        expect(query.query).toBe(
          'SHOW TAG VALUES FROM "rp"."test_measurement" WITH KEY = "test_key" WHERE "tagKey" = \'tag_val\''
        );
      });
    });

    describe('getFieldKeys', () => {
      it('with no retention policy', () => {
        getFieldKeys(ds, 'test_measurement');
        frontendModeChecks();
        expect(query.query).toBe('SHOW FIELD KEYS FROM "test_measurement"');
      });

      it('with empty measurement', () => {
        getFieldKeys(ds, '');
        frontendModeChecks();
        expect(query.query).toBe('SHOW FIELD KEYS');
      });

      it('with retention policy', () => {
        getFieldKeys(ds, 'test_measurement', 'rp');
        frontendModeChecks();
        expect(query.query).toBe('SHOW FIELD KEYS FROM "rp"."test_measurement"');
      });
    });
  });

  describe('backend mode enabled', () => {
    beforeEach(() => {
      config.featureToggles.influxdbBackendMigration = true;
    });

    function backendModeChecks() {
      expect(mockMetricFindQuery).not.toHaveBeenCalled();
      expect(mockRunMetadataQuery).toHaveBeenCalled();
      expect(target).toBeDefined();
      expect(target.refId).toBe('metadataQuery');
      expect(target.rawQuery).toBe(true);
    }

    describe('getAllPolicies', () => {
      it('should call metricFindQuery with SHOW RETENTION POLICIES', () => {
        getAllPolicies(ds);
        backendModeChecks();
        expect(query.query).toMatch('SHOW RETENTION POLICIES');
      });
    });

    describe('getAllMeasurements', () => {
      it('no tags specified', () => {
        getAllMeasurements(ds, []);
        backendModeChecks();
        expect(query.query).toBe('SHOW MEASUREMENTS LIMIT 100');
      });

      it('with tags', () => {
        getAllMeasurements(ds, [{ key: 'key', value: 'val' }]);
        backendModeChecks();
        expect(query.query).toMatch('SHOW MEASUREMENTS WHERE "key"');
      });

      it('with measurement filter', () => {
        getAllMeasurements(ds, [{ key: 'key', value: 'val' }], 'measurementFilter');
        backendModeChecks();
        expect(query.query).toMatch('SHOW MEASUREMENTS WITH MEASUREMENT =~ /(?i)measurementFilter/ WHERE "key"');
      });
    });

    describe('getTagKeys', () => {
      it('no tags specified', () => {
        getTagKeys(ds);
        backendModeChecks();
        expect(query.query).toBe('SHOW TAG KEYS');
      });

      it('with measurement', () => {
        getTagKeys(ds, 'test_measurement');
        backendModeChecks();
        expect(query.query).toBe('SHOW TAG KEYS FROM "test_measurement"');
      });

      it('with retention policy', () => {
        getTagKeys(ds, 'test_measurement', 'rp');
        backendModeChecks();
        expect(query.query).toBe('SHOW TAG KEYS FROM "rp"."test_measurement"');
      });
    });

    describe('getTagValues', () => {
      it('with key', () => {
        getTagValues(ds, [], 'test_key');
        backendModeChecks();
        expect(query.query).toBe('SHOW TAG VALUES WITH KEY = "test_key"');
      });

      it('with key ends with ::tag', () => {
        getTagValues(ds, [], 'test_key::tag');
        backendModeChecks();
        expect(query.query).toBe('SHOW TAG VALUES WITH KEY = "test_key"');
      });

      it('with key ends with ::field', async () => {
        const result = await getTagValues(ds, [], 'test_key::field');
        expect(result.length).toBe(0);
      });

      it('with tags', () => {
        getTagValues(ds, [{ key: 'tagKey', value: 'tag_val' }], 'test_key');
        backendModeChecks();
        expect(query.query).toBe('SHOW TAG VALUES WITH KEY = "test_key" WHERE "tagKey" = \'tag_val\'');
      });

      it('with measurement', () => {
        getTagValues(ds, [{ key: 'tagKey', value: 'tag_val' }], 'test_key', 'test_measurement');
        backendModeChecks();
        expect(query.query).toBe(
          'SHOW TAG VALUES FROM "test_measurement" WITH KEY = "test_key" WHERE "tagKey" = \'tag_val\''
        );
      });

      it('with retention policy', () => {
        getTagValues(ds, [{ key: 'tagKey', value: 'tag_val' }], 'test_key', 'test_measurement', 'rp');
        backendModeChecks();
        expect(query.query).toBe(
          'SHOW TAG VALUES FROM "rp"."test_measurement" WITH KEY = "test_key" WHERE "tagKey" = \'tag_val\''
        );
      });
    });

    describe('getFieldKeys', () => {
      it('with no retention policy', () => {
        getFieldKeys(ds, 'test_measurement');
        backendModeChecks();
        expect(query.query).toBe('SHOW FIELD KEYS FROM "test_measurement"');
      });

      it('with empty measurement', () => {
        getFieldKeys(ds, '');
        backendModeChecks();
        expect(query.query).toBe('SHOW FIELD KEYS');
      });

      it('with retention policy', () => {
        getFieldKeys(ds, 'test_measurement', 'rp');
        backendModeChecks();
        expect(query.query).toBe('SHOW FIELD KEYS FROM "rp"."test_measurement"');
      });
    });
  });
});
