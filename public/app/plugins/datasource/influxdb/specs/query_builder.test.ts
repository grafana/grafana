import { InfluxQueryBuilder } from '../query_builder';

describe('InfluxQueryBuilder', () => {
  describe('when building explore queries', () => {
    it('should only have measurement condition in tag keys query given query with measurement', () => {
      const builder = new InfluxQueryBuilder({ measurement: 'cpu', tags: [] });
      const query = builder.buildExploreQuery('TAG_KEYS');
      expect(query).toBe('SHOW TAG KEYS FROM "cpu"');
    });

    it('should handle regex measurement in tag keys query', () => {
      const builder = new InfluxQueryBuilder({
        measurement: '/.*/',
        tags: [],
      });
      const query = builder.buildExploreQuery('TAG_KEYS');
      expect(query).toBe('SHOW TAG KEYS FROM /.*/');
    });

    it('should have no conditions in tags keys query given query with no measurement or tag', () => {
      const builder = new InfluxQueryBuilder({ measurement: '', tags: [] });
      const query = builder.buildExploreQuery('TAG_KEYS');
      expect(query).toBe('SHOW TAG KEYS');
    });

    it('should have where condition in tag keys query with tags', () => {
      const builder = new InfluxQueryBuilder({
        measurement: '',
        tags: [{ key: 'host', value: 'se1' }],
      });
      const query = builder.buildExploreQuery('TAG_KEYS');
      expect(query).toBe('SHOW TAG KEYS WHERE "host" = \'se1\'');
    });

    it('should ignore condition if operator is a value operator', () => {
      const builder = new InfluxQueryBuilder({
        measurement: '',
        tags: [{ key: 'value', value: '10', operator: '>' }],
      });
      const query = builder.buildExploreQuery('TAG_KEYS');
      expect(query).toBe('SHOW TAG KEYS');
    });

    it('should have no conditions in measurement query for query with no tags', () => {
      const builder = new InfluxQueryBuilder({ measurement: '', tags: [] });
      const query = builder.buildExploreQuery('MEASUREMENTS');
      expect(query).toBe('SHOW MEASUREMENTS LIMIT 100');
    });

    it('should have no conditions in measurement query for query with no tags and empty query', () => {
      const builder = new InfluxQueryBuilder({ measurement: '', tags: [] });
      const query = builder.buildExploreQuery('MEASUREMENTS', undefined, '');
      expect(query).toBe('SHOW MEASUREMENTS LIMIT 100');
    });

    it('should have WITH MEASUREMENT in measurement query for non-empty query with no tags', () => {
      const builder = new InfluxQueryBuilder({ measurement: '', tags: [] });
      const query = builder.buildExploreQuery('MEASUREMENTS', undefined, 'something');
      expect(query).toBe('SHOW MEASUREMENTS WITH MEASUREMENT =~ /(?i)something/ LIMIT 100');
    });

    it('should escape the regex value in measurement query', () => {
      const builder = new InfluxQueryBuilder({ measurement: '', tags: [] });
      const query = builder.buildExploreQuery('MEASUREMENTS', undefined, 'abc/edf/');
      expect(query).toBe('SHOW MEASUREMENTS WITH MEASUREMENT =~ /(?i)abc\\/edf\\// LIMIT 100');
    });

    it('should have WITH MEASUREMENT WHERE in measurement query for non-empty query with tags', () => {
      const builder = new InfluxQueryBuilder({
        measurement: '',
        tags: [{ key: 'app', value: 'email' }],
      });
      const query = builder.buildExploreQuery('MEASUREMENTS', undefined, 'something');
      expect(query).toBe('SHOW MEASUREMENTS WITH MEASUREMENT =~ /(?i)something/ WHERE "app" = \'email\' LIMIT 100');
    });

    it('should have where condition in measurement query for query with tags', () => {
      const builder = new InfluxQueryBuilder({
        measurement: '',
        tags: [{ key: 'app', value: 'email' }],
      });
      const query = builder.buildExploreQuery('MEASUREMENTS');
      expect(query).toBe('SHOW MEASUREMENTS WHERE "app" = \'email\' LIMIT 100');
    });

    it('should have where tag name IN filter in tag values query for query with one tag', () => {
      const builder = new InfluxQueryBuilder({
        measurement: '',
        tags: [{ key: 'app', value: 'asdsadsad' }],
      });
      const query = builder.buildExploreQuery('TAG_VALUES', 'app');
      expect(query).toBe('SHOW TAG VALUES WITH KEY = "app"');
    });

    it('should have measurement tag condition and tag name IN filter in tag values query', () => {
      const builder = new InfluxQueryBuilder({
        measurement: 'cpu',
        tags: [
          { key: 'app', value: 'email' },
          { key: 'host', value: 'server1' },
        ],
      });
      const query = builder.buildExploreQuery('TAG_VALUES', 'app');
      expect(query).toBe('SHOW TAG VALUES FROM "cpu" WITH KEY = "app" WHERE "host" = \'server1\'');
    });

    it('should select from policy correctly if policy is specified', () => {
      const builder = new InfluxQueryBuilder({
        measurement: 'cpu',
        policy: 'one_week',
        tags: [
          { key: 'app', value: 'email' },
          { key: 'host', value: 'server1' },
        ],
      });
      const query = builder.buildExploreQuery('TAG_VALUES', 'app');
      expect(query).toBe('SHOW TAG VALUES FROM "one_week"."cpu" WITH KEY = "app" WHERE "host" = \'server1\'');
    });

    it('should not include policy when policy is default', () => {
      const builder = new InfluxQueryBuilder({
        measurement: 'cpu',
        policy: 'default',
        tags: [],
      });
      const query = builder.buildExploreQuery('TAG_VALUES', 'app');
      expect(query).toBe('SHOW TAG VALUES FROM "cpu" WITH KEY = "app"');
    });

    it('should switch to regex operator in tag condition', () => {
      const builder = new InfluxQueryBuilder({
        measurement: 'cpu',
        tags: [{ key: 'host', value: '/server.*/' }],
      });
      const query = builder.buildExploreQuery('TAG_VALUES', 'app');
      expect(query).toBe('SHOW TAG VALUES FROM "cpu" WITH KEY = "app" WHERE "host" =~ /server.*/');
    });

    it('should build show field query', () => {
      const builder = new InfluxQueryBuilder({
        measurement: 'cpu',
        tags: [{ key: 'app', value: 'email' }],
      });
      const query = builder.buildExploreQuery('FIELDS');
      expect(query).toBe('SHOW FIELD KEYS FROM "cpu"');
    });

    it('should build show field query with regexp', () => {
      const builder = new InfluxQueryBuilder({
        measurement: '/$var/',
        tags: [{ key: 'app', value: 'email' }],
      });
      const query = builder.buildExploreQuery('FIELDS');
      expect(query).toBe('SHOW FIELD KEYS FROM /$var/');
    });

    it('should build show retention policies query', () => {
      const builder = new InfluxQueryBuilder({ measurement: 'cpu', tags: [] }, 'site');
      const query = builder.buildExploreQuery('RETENTION POLICIES');
      expect(query).toBe('SHOW RETENTION POLICIES on "site"');
    });

    it('should handle tag-value=number-ish when getting measurements', () => {
      const builder = new InfluxQueryBuilder(
        { measurement: undefined, tags: [{ key: 'app', value: '42', operator: '==' }] },
        undefined
      );
      const query = builder.buildExploreQuery('MEASUREMENTS');
      expect(query).toBe(`SHOW MEASUREMENTS WHERE "app" == '42' LIMIT 100`);
    });

    it('should handle tag-value=number-ish getting tag-keys', () => {
      const builder = new InfluxQueryBuilder(
        { measurement: undefined, tags: [{ key: 'app', value: '42', operator: '==' }] },
        undefined
      );
      const query = builder.buildExploreQuery('TAG_KEYS');
      expect(query).toBe(`SHOW TAG KEYS WHERE "app" == '42'`);
    });

    it('should handle tag-value-contains-backslash-character getting tag-keys', () => {
      const builder = new InfluxQueryBuilder(
        { measurement: undefined, tags: [{ key: 'app', value: 'lab\\el', operator: '==' }] },
        undefined
      );
      const query = builder.buildExploreQuery('TAG_KEYS');
      expect(query).toBe(`SHOW TAG KEYS WHERE "app" == 'lab\\\\el'`);
    });

    it('should handle tag-value-contains-single-quote-character getting tag-keys', () => {
      const builder = new InfluxQueryBuilder(
        { measurement: undefined, tags: [{ key: 'app', value: "lab'el", operator: '==' }] },
        undefined
      );
      const query = builder.buildExploreQuery('TAG_KEYS');
      expect(query).toBe(`SHOW TAG KEYS WHERE "app" == 'lab\\'el'`);
    });

    it('should handle tag-value=emptry-string when getting measurements', () => {
      const builder = new InfluxQueryBuilder(
        { measurement: undefined, tags: [{ key: 'app', value: '', operator: '==' }] },
        undefined
      );
      const query = builder.buildExploreQuery('MEASUREMENTS');
      expect(query).toBe(`SHOW MEASUREMENTS WHERE "app" == '' LIMIT 100`);
    });

    it('should handle tag-value=emptry-string when getting tag-keys', () => {
      const builder = new InfluxQueryBuilder(
        { measurement: undefined, tags: [{ key: 'app', value: '', operator: '==' }] },
        undefined
      );
      const query = builder.buildExploreQuery('TAG_KEYS');
      expect(query).toBe(`SHOW TAG KEYS WHERE "app" == ''`);
    });
  });
});
