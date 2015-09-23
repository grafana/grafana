define([
  'app/plugins/datasource/elasticsearch/elasticResponse',
], function(ElasticResponse) {
  'use strict';

  describe('ElasticResponse', function() {
    var targets;
    var response;
    var result;

    describe('simple query and count', function() {

      beforeEach(function() {
        targets = [{
          refId: 'A',
          metrics: [{type: 'count', id: '1'}],
          bucketAggs: [{type: 'date_histogram', field: '@timestamp', id: '2'}],
        }];
        response = {
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
        };

        result = new ElasticResponse(targets, response).getTimeSeries();
      });

      it('should return 1 series', function() {
        expect(result.data.length).to.be(1);
        expect(result.data[0].target).to.be('Count');
        expect(result.data[0].datapoints.length).to.be(2);
        expect(result.data[0].datapoints[0][0]).to.be(10);
        expect(result.data[0].datapoints[0][1]).to.be(1000);
      });

    });

    describe('simple query count & avg aggregation', function() {
      var result;

      beforeEach(function() {
        targets = [{
          refId: 'A',
          metrics: [{type: 'count', id: '1'}, {type: 'avg', field: 'value', id: '2'}],
          bucketAggs: [{type: 'date_histogram', field: '@timestamp', id: '3'}],
        }];
        response = {
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
        };

        result = new ElasticResponse(targets, response).getTimeSeries();
      });

      it('should return 2 series', function() {
        expect(result.data.length).to.be(2);
        expect(result.data[0].datapoints.length).to.be(2);
        expect(result.data[0].datapoints[0][0]).to.be(10);
        expect(result.data[0].datapoints[0][1]).to.be(1000);

        expect(result.data[1].target).to.be("Average value");
        expect(result.data[1].datapoints[0][0]).to.be(88);
        expect(result.data[1].datapoints[1][0]).to.be(99);
      });

    });

    describe('single group by query one metric', function() {
      var result;

      beforeEach(function() {
        targets = [{
          refId: 'A',
          metrics: [{type: 'count', id: '1'}],
          bucketAggs: [{type: 'terms', field: 'host', id: '2'}, {type: 'date_histogram', field: '@timestamp', id: '3'}],
        }];
        response =  {
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
        };

        result = new ElasticResponse(targets, response).getTimeSeries();
      });

      it('should return 2 series', function() {
        expect(result.data.length).to.be(2);
        expect(result.data[0].datapoints.length).to.be(2);
        expect(result.data[0].target).to.be('server1');
        expect(result.data[1].target).to.be('server2');
      });
    });

    describe('single group by query two metrics', function() {
      var result;

      beforeEach(function() {
        targets = [{
          refId: 'A',
          metrics: [{type: 'count', id: '1'}, {type: 'avg', field: '@value', id: '4'}],
          bucketAggs: [{type: 'terms', field: 'host', id: '2'}, {type: 'date_histogram', field: '@timestamp', id: '3'}],
        }];
        response =  {
          responses: [{
            aggregations: {
              "2": {
                buckets: [
                  {
                    "3": {
                      buckets: [
                        { "4": {value: 10}, doc_count: 1, key: 1000},
                        { "4": {value: 12}, doc_count: 3, key: 2000}
                      ]
                    },
                    doc_count: 4,
                    key: 'server1',
                  },
                  {
                    "3": {
                      buckets: [
                        { "4": {value: 20}, doc_count: 1, key: 1000},
                        { "4": {value: 32}, doc_count: 3, key: 2000}
                      ]
                    },
                    doc_count: 10,
                    key: 'server2',
                  },
                ]
              }
            }
          }]
        };

        result = new ElasticResponse(targets, response).getTimeSeries();
      });

      it('should return 2 series', function() {
        expect(result.data.length).to.be(4);
        expect(result.data[0].datapoints.length).to.be(2);
        expect(result.data[0].target).to.be('server1 Count');
        expect(result.data[1].target).to.be('server1 Average @value');
        expect(result.data[2].target).to.be('server2 Count');
        expect(result.data[3].target).to.be('server2 Average @value');
      });
    });

    describe('with percentiles ', function() {
      var result;

      beforeEach(function() {
        targets = [{
          refId: 'A',
          metrics: [{type: 'percentiles', settings: {percents: [75, 90]},  id: '1'}],
          bucketAggs: [{type: 'date_histogram', field: '@timestamp', id: '3'}],
        }];
        response = {
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
        };

        result = new ElasticResponse(targets, response).getTimeSeries();
      });

      it('should return 2 series', function() {
        expect(result.data.length).to.be(2);
        expect(result.data[0].datapoints.length).to.be(2);
        expect(result.data[0].target).to.be('p75');
        expect(result.data[1].target).to.be('p90');
        expect(result.data[0].datapoints[0][0]).to.be(3.3);
        expect(result.data[0].datapoints[0][1]).to.be(1000);
        expect(result.data[1].datapoints[1][0]).to.be(4.5);
      });
    });

    describe('with extended_stats', function() {
      var result;

      beforeEach(function() {
        targets = [{
          refId: 'A',
          metrics: [{type: 'extended_stats', meta: {max: true, std_deviation_bounds_upper: true},  id: '1'}],
          bucketAggs: [{type: 'terms', field: 'host', id: '3'}, {type: 'date_histogram', id: '4'}],
        }];
        response = {
          responses: [{
            aggregations: {
              "3": {
                buckets: [
                  {
                    key: 'server1',
                    "4": {
                      buckets: [{
                        "1": {max: 10.2, min: 5.5, std_deviation_bounds: {upper: 3, lower: -2}},
                        doc_count: 10,
                        key: 1000
                      }]
                    }
                  },
                  {
                    key: 'server2',
                    "4": {
                      buckets: [{
                        "1": {max: 10.2, min: 5.5, std_deviation_bounds: {upper: 3, lower: -2}},
                        doc_count: 10,
                        key: 1000
                      }]
                    }
                  },
                ]
              }
            }
          }]
        };

        result = new ElasticResponse(targets, response).getTimeSeries();
      });

      it('should return 4 series', function() {
        expect(result.data.length).to.be(4);
        expect(result.data[0].datapoints.length).to.be(1);
        expect(result.data[0].target).to.be('server1 Max');
        expect(result.data[1].target).to.be('server1 Std Dev Upper');

        expect(result.data[0].datapoints[0][0]).to.be(10.2);
        expect(result.data[1].datapoints[0][0]).to.be(3);
      });
    });

    describe('single group by with alias pattern', function() {
      var result;

      beforeEach(function() {
        targets = [{
          refId: 'A',
          metrics: [{type: 'count', id: '1'}],
          alias: '{{term @host}} {{metric}} and!',
          bucketAggs: [
            {type: 'terms', field: '@host', id: '2'},
            {type: 'date_histogram', field: '@timestamp', id: '3'}
          ],
        }];
        response =  {
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
        };

        result = new ElasticResponse(targets, response).getTimeSeries();
      });

      it('should return 2 series', function() {
        expect(result.data.length).to.be(2);
        expect(result.data[0].datapoints.length).to.be(2);
        expect(result.data[0].target).to.be('server1 Count and!');
        expect(result.data[1].target).to.be('server2 Count and!');
      });
    });

    describe('with two filters agg', function() {
      var result;

      beforeEach(function() {
        targets = [{
          refId: 'A',
          metrics: [{type: 'count', id: '1'}],
          bucketAggs: [
            {
              id: '2',
              type: 'filters',
              settings: {
                filters: [
                  {query: '@metric:cpu' },
                  {query: '@metric:logins.count' },
                ]
              }
            },
            {type: 'date_histogram', field: '@timestamp', id: '3'}
          ],
        }];
        response =  {
          responses: [{
            aggregations: {
              "2": {
                buckets: {
                  "@metric:cpu": {
                    "3": {
                      buckets: [
                        {doc_count: 1, key: 1000},
                        {doc_count: 3, key: 2000}
                      ]
                    },
                  },
                  "@metric:logins.count": {
                    "3": {
                      buckets: [
                        {doc_count: 2, key: 1000},
                        {doc_count: 8, key: 2000}
                      ]
                    },
                  },
                }
              }
            }
          }]
        };

        result = new ElasticResponse(targets, response).getTimeSeries();
      });

      it('should return 2 series', function() {
        expect(result.data.length).to.be(2);
        expect(result.data[0].datapoints.length).to.be(2);
        expect(result.data[0].target).to.be('@metric:cpu');
        expect(result.data[1].target).to.be('@metric:logins.count');
      });
    });

  });
});
