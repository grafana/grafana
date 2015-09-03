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

      describe('simple query', function() {
        var result;

        beforeEach(function() {
          result = ctx.ds._processTimeSeries([{
            refId: 'A',
            groupByFields: [],
          }], {
            responses: [{
              aggregations: {
                histogram: {
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
          })
        });

        it('should return 1 series', function() {
          expect(result.data.length).to.be(1);
          expect(result.data[0].datapoints.length).to.be(2);
          expect(result.data[0].datapoints[0][0]).to.be(10);
          expect(result.data[0].datapoints[0][1]).to.be(1000);
        });

      });

      describe('single group by query', function() {
        var result;

        beforeEach(function() {
          result = ctx.ds._processTimeSeries([
            {
              refId: 'A',
              groupByFields: [
                {field: 'host' }
              ]
            }
          ], {
            responses: [{
              aggregations: {
                histogram: {
                  buckets: [
                    {
                      host: {
                        buckets: [
                           {doc_count: 4, key: 'server1'},
                           {doc_count: 6, key: 'server2'},
                        ]
                      },
                      doc_count: 10,
                      key: 1000
                    },
                    {
                      host: {
                        buckets: [
                           {doc_count: 4, key: 'server1'},
                           {doc_count: 6, key: 'server2'},
                        ]
                      },
                      doc_count: 15,
                      key: 2000
                    }
                  ]
                }
              }
            }]
          })
        });

        it('should return 2 series', function() {
          expect(result.data.length).to.be(2);
          expect(result.data[0].datapoints.length).to.be(2);
          expect(result.data[0].target).to.be('server1');
          expect(result.data[1].target).to.be('server2');
        });
      });
    });
  });
});
