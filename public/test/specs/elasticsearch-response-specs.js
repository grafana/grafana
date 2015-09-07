define([
  'plugins/datasource/elasticsearch/elasticResponse',
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

        expect(result.data[1].target).to.be("A value avg");
        expect(result.data[1].datapoints[0][0]).to.be(88);
        expect(result.data[1].datapoints[1][0]).to.be(99);
      });

    });

    describe('single group by query', function() {
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
        expect(result.data[0].target).to.be('A server1 count');
        expect(result.data[1].target).to.be('A server2 count');
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
        expect(result.data[0].target).to.be('A 75');
        expect(result.data[1].target).to.be('A 90');
        expect(result.data[0].datapoints[0][0]).to.be(3.3);
        expect(result.data[0].datapoints[0][1]).to.be(1000);
        expect(result.data[1].datapoints[1][0]).to.be(4.5);
      });
    });

    describe('with extended_stats ', function() {
      var result;

      beforeEach(function() {
        targets = [{
          refId: 'A',
          metrics: [{type: 'extended_stats', meta: {max: true, std_deviation_bounds_upper: true},  id: '1'}],
          bucketAggs: [{type: 'date_histogram', id: '3'}],
        }];
        response = {
          responses: [{
            aggregations: {
              "3": {
                buckets: [
                  {
                    "1": {max: 10.2, min: 5.5, std_deviation_bounds: {upper: 3, lower: -2}},
                    doc_count: 10,
                    key: 1000
                  },
                  {
                    "1": {max: 7.2, min: 3.5, std_deviation_bounds: {upper: 4, lower: -1}},
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
        expect(result.data[0].target).to.be('A max');
        expect(result.data[1].target).to.be('A std_deviation_bounds_upper');

        expect(result.data[0].datapoints[0][0]).to.be(10.2);
        expect(result.data[0].datapoints[1][0]).to.be(7.2);

        expect(result.data[1].datapoints[0][0]).to.be(3);
        expect(result.data[1].datapoints[1][0]).to.be(4);
      });
    });

  });
});
