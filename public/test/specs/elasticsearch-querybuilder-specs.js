define([
  'plugins/datasource/elasticsearch/queryBuilder'
], function(ElasticQueryBuilder) {
  'use strict';

  describe('ElasticQueryBuilder', function() {

    it('with defaults', function() {
      var builder = new ElasticQueryBuilder();

      var query = builder.build({
<<<<<<< 0af4a2236a22e275e123953662a275a68ddb51ad
        select: [{agg: 'Count'}],
        groupByFields: [],
=======
        metrics: [{type: 'Count'}],
        timeField: '@timestamp',
        bucketAggs: [{type: 'date_histogram', field: '@timestamp'}],
>>>>>>> feat(editor): thing are starting to work again
      });

      expect(query.query.filtered.filter.bool.must[0].range["@timestamp"].gte).to.be("$timeFrom");
      expect(query.aggs.histogram.date_histogram.extended_bounds.min).to.be("$timeFrom");
    });

<<<<<<< 0af4a2236a22e275e123953662a275a68ddb51ad
=======
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


>>>>>>> feat(editor): thing are starting to work again
    it('with select field', function() {
      var builder = new ElasticQueryBuilder();

      var query = builder.build({
<<<<<<< 0af4a2236a22e275e123953662a275a68ddb51ad
        select: [{agg: 'avg', field: '@value'}],
        groupByFields: [],
=======
        metrics: [{type: 'avg', field: '@value'}],
        bucketAggs: [{type: 'date_histogram', field: '@timestamp'}],
>>>>>>> feat(editor): thing are starting to work again
      }, 100, 1000);

      var aggs = query.aggs.histogram.aggs;
      expect(aggs["0"].avg.field).to.be("@value");
    });


  });

});
