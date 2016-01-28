///<amd-dependency path="app/plugins/datasource/influxdb_08/query_builder" name="InfluxQueryBuilder"/>

import {describe, beforeEach, it, sinon, expect} from 'test/lib/common';

declare var InfluxQueryBuilder: any;

describe('InfluxQueryBuilder', function() {

  describe('series with conditon and group by', function() {
    var builder = new InfluxQueryBuilder({
      series: 'google.test',
      column: 'value',
      function: 'mean',
      condition: "code=1",
      groupby_field: 'code'
    });

    var query = builder.build();

    it('should generate correct query', function() {
      expect(query).to.be('select code, mean(value) from "google.test" where $timeFilter and code=1 ' +
                          'group by time($interval), code order asc');
    });

    it('should expose groupByFiled', function() {
      expect(builder.groupByField).to.be('code');
    });

  });

  describe('series with fill and minimum group by time', function() {
    var builder = new InfluxQueryBuilder({
      series: 'google.test',
      column: 'value',
      function: 'mean',
      fill: '0',
    });

    var query = builder.build();

    it('should generate correct query', function() {
      expect(query).to.be('select mean(value) from "google.test" where $timeFilter ' +
                          'group by time($interval) fill(0) order asc');
    });

  });

  describe('merge function detection', function() {
    it('should not quote wrap regex merged series', function() {
      var builder = new InfluxQueryBuilder({
        series: 'merge(/^google.test/)',
        column: 'value',
        function: 'mean'
      });

      var query = builder.build();

      expect(query).to.be('select mean(value) from merge(/^google.test/) where $timeFilter ' +
                          'group by time($interval) order asc');
    });

    it('should quote wrap series names that start with "merge"', function() {
      var builder = new InfluxQueryBuilder({
        series: 'merge.google.test',
        column: 'value',
        function: 'mean'
      });

      var query = builder.build();

      expect(query).to.be('select mean(value) from "merge.google.test" where $timeFilter ' +
                          'group by time($interval) order asc');
    });

  });

});

