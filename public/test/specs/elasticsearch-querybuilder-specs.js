define([
  'plugins/datasource/elasticsearch/queryBuilder'
], function(ElasticQueryBuilder) {
  'use strict';

  describe('ElasticQueryBuilder', function() {

    it('with defaults', function() {
      var builder = new ElasticQueryBuilder();

      var query = builder.build({
        timeField: '@timestamp',
        select: [{agg: 'Count'}],
        groupByFields: [],
      });

      expect(query.query.filtered.filter.bool.must[0].range["@timestamp"].gte).to.be("$timeFrom");
      expect(query.aggs.histogram.date_histogram.extended_bounds.min).to.be("$timeFrom");
    });

    it('with select field', function() {
      var builder = new ElasticQueryBuilder();

      var query = builder.build({
        select: [{agg: 'avg', field: '@value'}],
        groupByFields: [],
      }, 100, 1000);

      var aggs = query.aggs.histogram.aggs;
      expect(aggs["0"].avg.field).to.be("@value");
    });


  });

});
