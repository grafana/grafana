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
            select: [{agg: 'count'}],
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

      describe('simple query count & avg aggregation', function() {
        var result;

        beforeEach(function() {
          result = ctx.ds._processTimeSeries([{
            refId: 'A',
            select: [{agg: 'count'}, {agg: 'avg', field: 'value'}],
            groupByFields: [],
          }], {
            responses: [{
              aggregations: {
                histogram: {
                  buckets: [
                    {
                      "1": {value: 88},
                      doc_count: 10,
                      key: 1000
                    },
                    {
                      "1": {value: 99},
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
            select: [{agg: 'count'}],
            groupByFields: [{field: 'host' }]
          }], {
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
          expect(result.data[0].target).to.be('A server1 count');
          expect(result.data[1].target).to.be('A server2 count');
        });
      });

      describe('group by query 2 fields', function() {
        var result;

        beforeEach(function() {
          result = ctx.ds._processTimeSeries([{
              refId: 'A',
              select: [{agg: 'count'}],
              groupByFields: [{field: 'host'}, {field: 'site'}]
            }], {
            responses: [{
              aggregations: {
                histogram: {
                  buckets: [
                    {
                      host: {
                        buckets: [
                           {
                             site: {
                               buckets: [
                                 {doc_count: 3, key: 'backend'},
                                 {doc_count: 1, key: 'frontend'},
                               ],
                             },
                             doc_count: 4, key: 'server1'
                           },
                           {
                             site: {
                               buckets: [
                                 {doc_count: 3, key: 'backend'},
                                 {doc_count: 1, key: 'frontend'},
                               ],
                             },
                             doc_count: 6, key: 'server2'
                           },
                        ]
                      },
                      doc_count: 10,
                      key: 1000
                    },
                    {
                      host: {
                        buckets: [
                          {
                            site: {
                               buckets: [
                                 {doc_count: 3, key: 'backend'},
                                 {doc_count: 1, key: 'frontend'},
                               ],
                            },
                            doc_count: 4,
                            key: 'server1'
                          },
                          {
                            site: {
                               buckets: [
                                 {doc_count: 3, key: 'backend'},
                                 {doc_count: 1, key: 'frontend'},
                               ],
                            },
                            doc_count: 6,
                            key: 'server2'
                          },
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
          expect(result.data.length).to.be(4);
          expect(result.data[0].datapoints.length).to.be(2);
          expect(result.data[0].target).to.be('A server1 backend count');
          expect(result.data[1].target).to.be('A server1 frontend count');
          expect(result.data[2].target).to.be('A server2 backend count');
          expect(result.data[3].target).to.be('A server2 frontend count');
        });
      });

    });
  });
});
