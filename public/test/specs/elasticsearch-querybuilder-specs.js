define([
  'plugins/datasource/elasticsearch/queryBuilder'
], function(ElasticQueryBuilder) {
  'use strict';

  describe('ElasticQueryBuilder', function() {

    it('with defaults', function() {
      var builder = new ElasticQueryBuilder();

      var query = builder.build({
        metrics: [{type: 'Count'}],
        timeField: '@timestamp',
        bucketAggs: [{type: 'date_histogram', field: '@timestamp'}],
      });

      expect(query.query.filtered.filter.bool.must[0].range["@timestamp"].gte).to.be("$timeFrom");
      expect(query.aggs["b0"].date_histogram.extended_bounds.min).to.be("$timeFrom");
    });

    it('with multiple bucket aggs', function() {
      var builder = new ElasticQueryBuilder();

      var query = builder.build({
        metrics: [{type: 'Count'}],
        timeField: '@timestamp',
        bucketAggs: [
          {type: 'terms', field: '@host'},
          {type: 'date_histogram', field: '@timestamp'}
        ],
      });

      expect(query.aggs["b0"].terms.field).to.be("@host");
      expect(query.aggs["b0"].aggs["b1"].date_histogram.field).to.be("@timestamp");
    });


    it('with select field', function() {
      var builder = new ElasticQueryBuilder();

      var query = builder.build({
        metrics: [{type: 'avg', field: '@value'}],
        bucketAggs: [{type: 'date_histogram', field: '@timestamp'}],
      }, 100, 1000);

      var aggs = query.aggs["b0"].aggs;
      expect(aggs["m0"].avg.field).to.be("@value");
    });


  });

});
