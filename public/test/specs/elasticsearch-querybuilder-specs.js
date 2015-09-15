define([
  'app/plugins/datasource/elasticsearch/queryBuilder'
], function(ElasticQueryBuilder) {
  'use strict';

  describe('ElasticQueryBuilder', function() {

    it('with defaults', function() {
      var builder = new ElasticQueryBuilder();

      var query = builder.build({
<<<<<<< 65eac3f1cbacb552534483c12102fdaa3c14eba1
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

<<<<<<< 65eac3f1cbacb552534483c12102fdaa3c14eba1
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
<<<<<<< 65eac3f1cbacb552534483c12102fdaa3c14eba1
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
