///<amd-dependency path="app/plugins/datasource/influxdb/query_builder" name="InfluxQueryBuilder"/>

import {describe, beforeEach, it, sinon, expect} from 'test/lib/common';

declare var InfluxQueryBuilder: any;

describe('InfluxQueryBuilder', function() {

  describe('when building explore queries', function() {

    it('should only have measurement condition in tag keys query given query with measurement', function() {
      var builder = new InfluxQueryBuilder({ measurement: 'cpu', tags: [] });
      var query = builder.buildExploreQuery('TAG_KEYS');
      expect(query).to.be('SHOW TAG KEYS FROM "cpu"');
    });

    it('should handle regex measurement in tag keys query', function() {
      var builder = new InfluxQueryBuilder({
        measurement: '/.*/', tags: []
      });
      var query = builder.buildExploreQuery('TAG_KEYS');
      expect(query).to.be('SHOW TAG KEYS FROM /.*/');
    });

    it('should have no conditions in tags keys query given query with no measurement or tag', function() {
      var builder = new InfluxQueryBuilder({ measurement: '', tags: [] });
      var query = builder.buildExploreQuery('TAG_KEYS');
      expect(query).to.be('SHOW TAG KEYS');
    });

    it('should have where condition in tag keys query with tags', function() {
      var builder = new InfluxQueryBuilder({ measurement: '', tags: [{key: 'host', value: 'se1'}] });
      var query = builder.buildExploreQuery('TAG_KEYS');
      expect(query).to.be("SHOW TAG KEYS WHERE \"host\" = 'se1'");
    });

    it('should have no conditions in measurement query for query with no tags', function() {
      var builder = new InfluxQueryBuilder({ measurement: '', tags: [] });
      var query = builder.buildExploreQuery('MEASUREMENTS');
      expect(query).to.be('SHOW MEASUREMENTS');
    });

    it('should have where condition in measurement query for query with tags', function() {
      var builder = new InfluxQueryBuilder({measurement: '', tags: [{key: 'app', value: 'email'}]});
      var query = builder.buildExploreQuery('MEASUREMENTS');
      expect(query).to.be("SHOW MEASUREMENTS WHERE \"app\" = 'email'");
    });

    it('should have where tag name IN filter in tag values query for query with one tag', function() {
      var builder = new InfluxQueryBuilder({measurement: '', tags: [{key: 'app', value: 'asdsadsad'}]});
      var query = builder.buildExploreQuery('TAG_VALUES', 'app');
      expect(query).to.be('SHOW TAG VALUES WITH KEY = "app"');
    });

    it('should have measurement tag condition and tag name IN filter in tag values query', function() {
      var builder = new InfluxQueryBuilder({measurement: 'cpu', tags: [{key: 'app', value: 'email'}, {key: 'host', value: 'server1'}]});
      var query = builder.buildExploreQuery('TAG_VALUES', 'app');
      expect(query).to.be('SHOW TAG VALUES FROM "cpu" WITH KEY = "app" WHERE "host" = \'server1\'');
    });

    it('should switch to regex operator in tag condition', function() {
      var builder = new InfluxQueryBuilder({
        measurement: 'cpu',
        tags: [{key: 'host', value: '/server.*/'}]
      });
      var query = builder.buildExploreQuery('TAG_VALUES', 'app');
      expect(query).to.be('SHOW TAG VALUES FROM "cpu" WITH KEY = "app" WHERE "host" =~ /server.*/');
    });

    it('should build show field query', function() {
      var builder = new InfluxQueryBuilder({measurement: 'cpu', tags: [{key: 'app', value: 'email'}]});
      var query = builder.buildExploreQuery('FIELDS');
      expect(query).to.be('SHOW FIELD KEYS FROM "cpu"');
    });

  });

});
