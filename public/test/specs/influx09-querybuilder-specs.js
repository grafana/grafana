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

    describe('series with tags only', function() {
      var builder = new InfluxQueryBuilder({
        measurement: 'cpu',
        tags: {'hostname': 'server1'}
      });

      var query = builder.build();

      it('should generate correct query', function() {
        expect(query).to.be('SELECT mean(value) FROM "cpu" WHERE hostname = \'server1\'' +
          ' AND $timeFilter GROUP BY time($interval) ORDER BY asc');
      });

    });

  });

});
