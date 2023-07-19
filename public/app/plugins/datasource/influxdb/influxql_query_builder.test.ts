import { buildMetadataQuery } from './influxql_query_builder';
import { templateSrvStub as templateService } from './specs/mocks';

describe('influxql-query-builder', () => {
  describe('RETENTION_POLICIES', () => {
    it('should build retention policies query', () => {
      const query = buildMetadataQuery({
        type: 'RETENTION_POLICIES',
        templateService,
        database: 'site',
      });
      expect(query).toBe('SHOW RETENTION POLICIES on "site"');
    });
  });

  describe('FIELDS', () => {
    it('should build show field query', () => {
      const query = buildMetadataQuery({
        type: 'FIELDS',
        templateService,
        measurement: 'cpu',
        tags: [{ key: 'app', value: 'email' }],
      });
      expect(query).toBe('SHOW FIELD KEYS FROM "cpu"');
    });

    it('should build show field query with regexp', () => {
      const query = buildMetadataQuery({
        type: 'FIELDS',
        templateService,
        measurement: '/$var/',
        tags: [{ key: 'app', value: 'email' }],
      });
      expect(query).toBe('SHOW FIELD KEYS FROM /$var/');
    });
  });

  describe('TAG_KEYS', () => {
    it('should only have measurement condition in tag keys query given query with measurement', () => {
      const query = buildMetadataQuery({ type: 'TAG_KEYS', templateService, measurement: 'cpu', tags: [] });
      expect(query).toBe('SHOW TAG KEYS FROM "cpu"');
    });

    it('should handle regex measurement in tag keys query', () => {
      const query = buildMetadataQuery({
        type: 'TAG_KEYS',
        templateService,
        measurement: '/.*/',
        tags: [],
      });
      expect(query).toBe('SHOW TAG KEYS FROM /.*/');
    });

    it('should have no conditions in tags keys query given query with no measurement or tag', () => {
      const query = buildMetadataQuery({ type: 'TAG_KEYS', templateService, measurement: '', tags: [] });
      expect(query).toBe('SHOW TAG KEYS');
    });

    it('should have where condition in tag keys query with tags', () => {
      const query = buildMetadataQuery({
        type: 'TAG_KEYS',
        templateService,
        measurement: '',
        tags: [{ key: 'host', value: 'se1' }],
      });
      expect(query).toBe('SHOW TAG KEYS WHERE "host" = \'se1\'');
    });

    it('should ignore condition if operator is a value operator', () => {
      const query = buildMetadataQuery({
        type: 'TAG_KEYS',
        templateService,
        measurement: '',
        tags: [{ key: 'value', value: '10', operator: '>' }],
      });
      expect(query).toBe('SHOW TAG KEYS');
    });
    it('should handle tag-value=number-ish getting tag-keys', () => {
      const query = buildMetadataQuery({
        type: 'TAG_KEYS',
        templateService,
        measurement: undefined,
        tags: [{ key: 'app', value: '42', operator: '==' }],
        database: undefined,
      });
      expect(query).toBe(`SHOW TAG KEYS WHERE "app" == '42'`);
    });

    it('should handle tag-value-contains-backslash-character getting tag-keys', () => {
      const query = buildMetadataQuery({
        type: 'TAG_KEYS',
        templateService,
        measurement: undefined,
        tags: [{ key: 'app', value: 'lab\\el', operator: '==' }],
        database: undefined,
      });
      expect(query).toBe(`SHOW TAG KEYS WHERE "app" == 'lab\\\\el'`);
    });

    it('should handle tag-value-contains-single-quote-character getting tag-keys', () => {
      const query = buildMetadataQuery({
        type: 'TAG_KEYS',
        templateService,
        measurement: undefined,
        tags: [{ key: 'app', value: "lab'el", operator: '==' }],
        database: undefined,
      });
      expect(query).toBe(`SHOW TAG KEYS WHERE "app" == 'lab\\'el'`);
    });

    it('should handle tag-value=emptry-string when getting tag-keys', () => {
      const query = buildMetadataQuery({
        type: 'TAG_KEYS',
        templateService,
        measurement: undefined,
        tags: [{ key: 'app', value: '', operator: '==' }],
        database: undefined,
      });
      expect(query).toBe(`SHOW TAG KEYS WHERE "app" == ''`);
    });
  });

  describe('TAG_VALUES', () => {
    it('should have where tag name IN filter in tag values query for query with one tag', () => {
      const query = buildMetadataQuery({
        type: 'TAG_VALUES',
        templateService,
        withKey: 'app',
        measurement: '',
        tags: [{ key: 'app', value: 'asdsadsad' }],
      });
      expect(query).toBe('SHOW TAG VALUES WITH KEY = "app"');
    });

    it('should have measurement tag condition and tag name IN filter in tag values query', () => {
      const query = buildMetadataQuery({
        type: 'TAG_VALUES',
        templateService,
        withKey: 'app',
        measurement: 'cpu',
        tags: [
          { key: 'app', value: 'email' },
          { key: 'host', value: 'server1' },
        ],
      });
      expect(query).toBe('SHOW TAG VALUES FROM "cpu" WITH KEY = "app" WHERE "host" = \'server1\'');
    });

    it('should select from policy correctly if policy is specified', () => {
      const query = buildMetadataQuery({
        type: 'TAG_VALUES',
        templateService,
        withKey: 'app',
        measurement: 'cpu',
        retentionPolicy: 'one_week',
        tags: [
          { key: 'app', value: 'email' },
          { key: 'host', value: 'server1' },
        ],
      });
      expect(query).toBe('SHOW TAG VALUES FROM "one_week"."cpu" WITH KEY = "app" WHERE "host" = \'server1\'');
    });

    it('should not include policy when policy is default', () => {
      const query = buildMetadataQuery({
        type: 'TAG_VALUES',
        templateService,
        withKey: 'app',
        measurement: 'cpu',
        retentionPolicy: 'default',
        tags: [],
      });
      expect(query).toBe('SHOW TAG VALUES FROM "cpu" WITH KEY = "app"');
    });

    it('should switch to regex operator in tag condition', () => {
      const query = buildMetadataQuery({
        type: 'TAG_VALUES',
        templateService,
        withKey: 'app',
        measurement: 'cpu',
        tags: [{ key: 'host', value: '/server.*/' }],
      });
      expect(query).toBe('SHOW TAG VALUES FROM "cpu" WITH KEY = "app" WHERE "host" =~ /server.*/');
    });
  });

  describe('MEASUREMENTS', () => {
    it('should have no conditions in measurement query for query with no tags', () => {
      const query = buildMetadataQuery({ type: 'MEASUREMENTS', templateService, measurement: '', tags: [] });
      expect(query).toBe('SHOW MEASUREMENTS LIMIT 100');
    });

    it('should have no conditions in measurement query for query with no tags and empty query', () => {
      const query = buildMetadataQuery({
        type: 'MEASUREMENTS',
        templateService,
        withKey: undefined,
        withMeasurementFilter: '',
        measurement: '',
        tags: [],
      });
      expect(query).toBe('SHOW MEASUREMENTS LIMIT 100');
    });

    it('should have WITH MEASUREMENT in measurement query for non-empty query with no tags', () => {
      const query = buildMetadataQuery({
        type: 'MEASUREMENTS',
        templateService,
        withKey: undefined,
        withMeasurementFilter: 'something',
        measurement: '',
        tags: [],
      });
      expect(query).toBe('SHOW MEASUREMENTS WITH MEASUREMENT =~ /(?i)something/ LIMIT 100');
    });

    it('should escape the regex value in measurement query', () => {
      const query = buildMetadataQuery({
        type: 'MEASUREMENTS',
        templateService,
        withKey: undefined,
        withMeasurementFilter: 'abc/edf/',
        measurement: '',
        tags: [],
      });
      expect(query).toBe('SHOW MEASUREMENTS WITH MEASUREMENT =~ /(?i)abc\\/edf\\// LIMIT 100');
    });

    it('should have WITH MEASUREMENT WHERE in measurement query for non-empty query with tags', () => {
      const query = buildMetadataQuery({
        type: 'MEASUREMENTS',
        templateService,
        withKey: undefined,
        withMeasurementFilter: 'something',
        measurement: '',
        tags: [{ key: 'app', value: 'email' }],
      });
      expect(query).toBe('SHOW MEASUREMENTS WITH MEASUREMENT =~ /(?i)something/ WHERE "app" = \'email\' LIMIT 100');
    });

    it('should have where condition in measurement query for query with tags', () => {
      const query = buildMetadataQuery({
        type: 'MEASUREMENTS',
        templateService,
        measurement: '',
        tags: [{ key: 'app', value: 'email' }],
      });
      expect(query).toBe('SHOW MEASUREMENTS WHERE "app" = \'email\' LIMIT 100');
    });

    it('should handle tag-value=number-ish when getting measurements', () => {
      const query = buildMetadataQuery({
        type: 'MEASUREMENTS',
        templateService,
        database: undefined,
        measurement: undefined,
        tags: [{ key: 'app', value: '42', operator: '==' }],
      });
      expect(query).toBe(`SHOW MEASUREMENTS WHERE "app" == '42' LIMIT 100`);
    });

    it('should handle tag-value=emptry-string when getting measurements', () => {
      const query = buildMetadataQuery({
        type: 'MEASUREMENTS',
        templateService,
        database: undefined,
        measurement: undefined,
        tags: [{ key: 'app', value: '', operator: '==' }],
      });
      expect(query).toBe(`SHOW MEASUREMENTS WHERE "app" == '' LIMIT 100`);
    });
  });

  it('should not add FROM statement if the measurement empty', () => {
    let query = buildMetadataQuery({ type: 'TAG_KEYS', templateService, measurement: '', tags: [] });
    expect(query).toBe('SHOW TAG KEYS');
    query = buildMetadataQuery({ type: 'FIELDS', templateService });
    expect(query).toBe('SHOW FIELD KEYS');
  });
});
