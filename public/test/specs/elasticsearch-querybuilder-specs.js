define([
  'plugins/datasource/elasticsearch/queryBuilder'
], function(ElasticQueryBuilder) {
  'use strict';

  describe('ElasticQueryBuilder', function() {

    it('with defaults', function() {
      var builder = new ElasticQueryBuilder();

      var query = builder.build({
        select: [{agg: 'Count'}],
        groupByFields: [],
      }, 100, 1000);

      expect(query.query.filtered.filter.bool.must[0].range["@timestamp"].gte).to.be(100);
      expect(query.aggs.histogram.date_histogram.extended_bounds.min).to.be(100);
    });

    it('with select field', function() {
      var builder = new ElasticQueryBuilder();

      var query = builder.build({
        select: [{agg: 'Avg', field: '@value'}],
        groupByFields: [],
      }, 100, 1000);

      expect(query.query.filtered.filter.bool.must[0].range["@timestamp"].gte).to.be(100);
    });


  });

});
