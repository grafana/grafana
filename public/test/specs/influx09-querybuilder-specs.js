define([
  'plugins/datasource/influxdb/queryBuilder'
], function(InfluxQueryBuilder) {
  'use strict';

  describe('InfluxQueryBuilder', function() {

    describe('series with mesurement only', function() {
      var builder = new InfluxQueryBuilder({
        measurement: 'cpu',
      });

      var query = builder.build();

      it('should generate correct query', function() {
        expect(query).to.be('SELECT mean(value) FROM "cpu" WHERE $timeFilter GROUP BY time($interval) ORDER BY asc');
      });

    });

    describe('series with single tag only', function() {
      var builder = new InfluxQueryBuilder({
        measurement: 'cpu',
        tags: [{key: 'hostname', value: 'server1'}]
      });

      var query = builder.build();

      it('should generate correct query', function() {
        expect(query).to.be('SELECT mean(value) FROM "cpu" WHERE "hostname" = \'server1\' AND $timeFilter'
                            + ' GROUP BY time($interval) ORDER BY asc');
      });

      it('should switch regex operator with tag value is regex', function() {
        var builder = new InfluxQueryBuilder({measurement: 'cpu', tags: [{key: 'app', value: '/e.*/'}]});
        var query = builder.build();
        expect(query).to.be('SELECT mean(value) FROM "cpu" WHERE "app" =~ /e.*/ AND $timeFilter GROUP BY time($interval) ORDER BY asc');
      });
    });

    describe('series with multiple fields', function() {
      var builder = new InfluxQueryBuilder({
        measurement: 'cpu',
        tags: [],
        fields: [{ name: 'tx_in', func: 'sum' }, { name: 'tx_out', func: 'mean' }]
      });

      var query = builder.build();

      it('should generate correct query', function() {
        expect(query).to.be('SELECT sum(tx_in), mean(tx_out) FROM "cpu" WHERE $timeFilter GROUP BY time($interval) ORDER BY asc');
      });
    });

    describe('series with multiple tags only', function() {
      var builder = new InfluxQueryBuilder({
        measurement: 'cpu',
        tags: [{key: 'hostname', value: 'server1'}, {key: 'app', value: 'email', condition: "AND"}]
      });

      var query = builder.build();

      it('should generate correct query', function() {
        expect(query).to.be('SELECT mean(value) FROM "cpu" WHERE "hostname" = \'server1\' AND "app" = \'email\' AND ' +
                            '$timeFilter GROUP BY time($interval) ORDER BY asc');
      });
    });

    describe('series with tags OR condition', function() {
      var builder = new InfluxQueryBuilder({
        measurement: 'cpu',
        tags: [{key: 'hostname', value: 'server1'}, {key: 'hostname', value: 'server2', condition: "OR"}]
      });

      var query = builder.build();

      it('should generate correct query', function() {
        expect(query).to.be('SELECT mean(value) FROM "cpu" WHERE "hostname" = \'server1\' OR "hostname" = \'server2\' AND ' +
                            '$timeFilter GROUP BY time($interval) ORDER BY asc');
      });
    });

    describe('series with groupByTag', function() {
      it('should generate correct query', function() {
        var builder = new InfluxQueryBuilder({
          measurement: 'cpu',
          tags: [],
          groupByTags: ["host"]
        });

        var query = builder.build();
        expect(query).to.be('SELECT mean(value) FROM "cpu" WHERE $timeFilter ' +
          'GROUP BY time($interval), "host" ORDER BY asc');
      });
    });

    describe('when building explore queries', function() {

      it('should only have measurement condition in tag keys query given query with measurement', function() {
        var builder = new InfluxQueryBuilder({ measurement: 'cpu', tags: [] });
        var query = builder.buildExploreQuery('TAG_KEYS');
        expect(query).to.be('SHOW TAG KEYS FROM "cpu"');
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
        var builder = new InfluxQueryBuilder({measurement: 'cpu', tags: [{key: 'host', value: '/server.*/'}]});
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

});
