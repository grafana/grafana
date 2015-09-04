define([
  'helpers',
  'plugins/datasource/elasticsearch/datasource',
  'aws-sdk',
], function(helpers) {
  'use strict';

  describe('ElasticDatasource', function() {
    var ctx = new helpers.ServiceTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(ctx.providePhase(['templateSrv']));
    beforeEach(ctx.createService('ElasticDatasource'));
    beforeEach(function() {
      ctx.ds = new ctx.service({});
    });

    describe('When processing es response', function() {

      describe('simple query and count', function() {
        var result;

        beforeEach(function() {
          result = ctx.ds._processTimeSeries([{
            refId: 'A',
            metrics: [{agg: 'count'}],
            bucketAggs: [{type: 'date_histogram', field: '@timestamp'}],
          }], {
            responses: [{
              aggregations: {
                "b0": {
                  buckets: [
                    {
                      doc_count: 10,
                      key: 1000
                    },
                    {
                      doc_count: 15,
                      key: 2000
                    }
                  ]
                }
              }
            }]
          });
        });

        it('should return 1 series', function() {
          expect(result.data.length).to.be(1);
          expect(result.data[0].datapoints.length).to.be(2);
          expect(result.data[0].datapoints[0][0]).to.be(10);
          expect(result.data[0].datapoints[0][1]).to.be(1000);
        });

      });

      describe('simple query count & avg aggregation', function() {
        var result;

        beforeEach(function() {
          result = ctx.ds._processTimeSeries([{
            refId: 'A',
            metrics: [{agg: 'count'}, {agg: 'avg', field: 'value'}],
            bucketAggs: [{type: 'date_histogram', field: '@timestamp'}],
          }], {
            responses: [{
              aggregations: {
                "b0": {
                  buckets: [
                    {
                      "m1": {value: 88},
                      doc_count: 10,
                      key: 1000
                    },
                    {
                      "m1": {value: 99},
                      doc_count: 15,
                      key: 2000
                    }
                  ]
                }
              }
            }]
          });
        });

        it('should return 2 series', function() {
          expect(result.data.length).to.be(2);
          expect(result.data[0].datapoints.length).to.be(2);
          expect(result.data[0].datapoints[0][0]).to.be(10);
          expect(result.data[0].datapoints[0][1]).to.be(1000);

          expect(result.data[1].target).to.be("A value avg");
          expect(result.data[1].datapoints[0][0]).to.be(88);
          expect(result.data[1].datapoints[1][0]).to.be(99);
        });

      });

      describe('single group by query', function() {
        var result;

        beforeEach(function() {
          result = ctx.ds._processTimeSeries([{
            refId: 'A',
            metrics: [{agg: 'count'}],
            bucketAggs: [{type: 'terms', field: 'host'}, {type: 'date_histogram', field: '@timestamp'}],
          }], {
            responses: [{
              aggregations: {
                "b0": {
                  buckets: [
                    {
                      "b1": {
                        buckets: [
                          {doc_count: 1, key: 1000},
                          {doc_count: 3, key: 2000}
                        ]
                      },
                      doc_count: 4,
                      key: 'server1',
                    },
                    {
                      "b1": {
                        buckets: [
                          {doc_count: 2, key: 1000},
                          {doc_count: 8, key: 2000}
                        ]
                      },
                      doc_count: 10,
                      key: 'server2',
                    },
                  ]
                }
              }
            }]
          });
        });

        it('should return 2 series', function() {
          expect(result.data.length).to.be(2);
          expect(result.data[0].datapoints.length).to.be(2);
          expect(result.data[0].target).to.be('A server1 count');
          expect(result.data[1].target).to.be('A server2 count');
        });
      });

    });
  });
});
