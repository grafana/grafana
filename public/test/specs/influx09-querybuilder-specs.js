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
        expect(query).to.be('SELECT mean(value) FROM "cpu" WHERE hostname=\'server1\' AND $timeFilter'
                            + ' GROUP BY time($interval) ORDER BY asc');
      });

    });

    describe('series with multiple tags only', function() {
      var builder = new InfluxQueryBuilder({
        measurement: 'cpu',
        tags: [{key: 'hostname', value: 'server1'}, {key: 'app', value: 'email', condition: "AND"}]
      });

      var query = builder.build();

      it('should generate correct query', function() {
        expect(query).to.be('SELECT mean(value) FROM "cpu" WHERE hostname=\'server1\' AND app=\'email\' AND ' +
                            '$timeFilter GROUP BY time($interval) ORDER BY asc');
      });
    });

    describe('series with groupByTag', function() {
      var builder = new InfluxQueryBuilder({
        measurement: 'cpu',
        tags: [],
        groupByTags: ["host"]
      });

      var query = builder.build();

      it('should generate correct query', function() {
        expect(query).to.be('SELECT mean(value) FROM "cpu" WHERE $timeFilter ' +
          'GROUP BY time($interval), host ORDER BY asc');
      });
    });

    describe('when building tag keys query', function() {

      describe('given picked measurement', function() {
        it('build query with measurement filter', function() {
          var builder = new InfluxQueryBuilder({ measurement: 'cpu', tags: [] });
          var query = builder.showTagsQuery();
          expect(query).to.be('SHOW TAG KEYS FROM "cpu"');
        });
      });

      describe('given no picked measurement', function() {
        it('build query without filter', function() {
          var builder = new InfluxQueryBuilder({ measurement: '', tags: [] });
          var query = builder.showTagsQuery();
          expect(query).to.be('SHOW TAG KEYS');
        });
      });

      describe('given an existing tag', function() {
        it('build query with filter', function() {
          var builder = new InfluxQueryBuilder({ measurement: '', tags: [{key: 'host', value: 'se1'}] });
          var query = builder.showTagsQuery();
          expect(query).to.be('SHOW TAG KEYS');
        });
      });

    });

  });

});
