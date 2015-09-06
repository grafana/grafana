define([
  'helpers',
  'moment',
  'angular',
  'plugins/datasource/elasticsearch/datasource',
  'aws-sdk',
], function(helpers, moment, angular) {
  'use strict';

  describe('ElasticDatasource', function() {
    var ctx = new helpers.ServiceTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(ctx.providePhase(['templateSrv', 'backendSrv']));
    beforeEach(ctx.createService('ElasticDatasource'));
    beforeEach(function() {
      ctx.ds = new ctx.service({jsonData: {}});
    });

    describe('When testing datasource with index pattern', function() {
      beforeEach(function(){
        ctx.ds = new ctx.service({
          url: 'http://es.com',
          index: '[asd-]YYYY.MM.DD',
          jsonData: { interval: 'Daily' }
        });
      });

      it('should translate index pattern to current day', function() {
        var requestOptions;
        ctx.backendSrv.datasourceRequest = function(options) {
          requestOptions = options;
          return ctx.$q.when({});
        };

        ctx.ds.testDatasource();
        ctx.$rootScope.$apply();

        var today = moment().format("YYYY.MM.DD");
        expect(requestOptions.url).to.be("http://es.com/asd-" + today + '/_stats');
      });
    });

    describe('When issueing metric query with interval pattern', function() {
      beforeEach(function() {
        ctx.ds = new ctx.service({
          url: 'http://es.com',
          index: '[asd-]YYYY.MM.DD',
          jsonData: { interval: 'Daily' }
        });
      });

      it('should translate index pattern to current day', function() {
        var requestOptions;
        ctx.backendSrv.datasourceRequest = function(options) {
          requestOptions = options;
          return ctx.$q.when({data: {responses: []}});
        };

        ctx.ds.query({
          range: {
            from: new Date(2015, 4, 30, 10),
            to: new Date(2015, 5, 1, 10)
          },
          targets: [{ bucketAggs: [], metrics: [] }]
        });

        ctx.$rootScope.$apply();
        var parts = requestOptions.data.split('\n');
        var header = angular.fromJson(parts[0]);
        expect(header.index).to.eql(['asd-2015.05.30', 'asd-2015.05.31', 'asd-2015.06.01']);
      });
    });

    describe('When processing es response', function() {

      describe('simple query and count', function() {
        var result;

        beforeEach(function() {
          result = ctx.ds._processTimeSeries([{
            refId: 'A',
            metrics: [{type: 'count', id: '1'}],
            bucketAggs: [{type: 'date_histogram', field: '@timestamp', id: '2'}],
          }], {
            responses: [{
              aggregations: {
                "2": {
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
            metrics: [{type: 'count', id: '1'}, {type: 'avg', field: 'value', id: '2'}],
            bucketAggs: [{type: 'date_histogram', field: '@timestamp', id: '3'}],
          }], {
            responses: [{
              aggregations: {
                "3": {
                  buckets: [
                    {
                      "2": {value: 88},
                      doc_count: 10,
                      key: 1000
                    },
                    {
                      "2": {value: 99},
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
            metrics: [{type: 'count', id: '1'}],
            bucketAggs: [{type: 'terms', field: 'host', id: '2'}, {type: 'date_histogram', field: '@timestamp', id: '3'}],
          }], {
            responses: [{
              aggregations: {
                "2": {
                  buckets: [
                    {
                      "3": {
                        buckets: [
                          {doc_count: 1, key: 1000},
                          {doc_count: 3, key: 2000}
                        ]
                      },
                      doc_count: 4,
                      key: 'server1',
                    },
                    {
                      "3": {
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

      describe('with percentiles ', function() {
        var result;

        beforeEach(function() {
          result = ctx.ds._processTimeSeries([{
            refId: 'A',
            metrics: [{type: 'percentiles', settings: {percents: [75, 90]},  id: '1'}],
            bucketAggs: [{type: 'date_histogram', field: '@timestamp', id: '3'}],
          }], {
            responses: [{
              aggregations: {
                "3": {
                  buckets: [
                    {
                      "1": {values: {"75": 3.3, "90": 5.5}},
                      doc_count: 10,
                      key: 1000
                    },
                    {
                      "1": {values: {"75": 2.3, "90": 4.5}},
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
          expect(result.data[0].target).to.be('A 75');
          expect(result.data[1].target).to.be('A 90');
          expect(result.data[0].datapoints[0][0]).to.be(3.3);
          expect(result.data[0].datapoints[0][1]).to.be(1000);
          expect(result.data[1].datapoints[1][0]).to.be(4.5);
        });
      });


    });
  });
});
