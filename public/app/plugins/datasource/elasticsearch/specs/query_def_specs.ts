
import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

import queryDef from '../query_def';

describe('ElasticQueryDef', function() {

  describe('getPipelineAggOptions', function() {
    describe('with zero targets', function() {
      var response = queryDef.getPipelineAggOptions([]);

      it('should return zero', function() {
        expect(response.length).to.be(0);
      });
    });

    describe('with count and sum targets', function() {
      var targets = {
        metrics: [
          { type: 'count', field: '@value' },
          { type: 'sum', field: '@value' }
        ]
      };

      var response = queryDef.getPipelineAggOptions(targets);

      it('should return zero', function() {
        expect(response.length).to.be(2);
      });
    });

    describe('with count and moving average targets', function() {
      var targets = {
        metrics: [
          { type: 'count', field: '@value' },
          { type: 'moving_avg', field: '@value' }
        ]
      };

      var response = queryDef.getPipelineAggOptions(targets);

      it('should return one', function() {
        expect(response.length).to.be(1);
      });
    });

    describe('with derivatives targets', function() {
      var targets = {
        metrics: [
          { type: 'derivative', field: '@value' }
        ]
      };

      var response = queryDef.getPipelineAggOptions(targets);

      it('should return zero', function() {
        expect(response.length).to.be(0);
      });
    });
  });

  describe('isPipelineMetric', function() {
    describe('moving_avg', function() {
      var result = queryDef.isPipelineAgg('moving_avg');

      it('is pipe line metric', function() {
        expect(result).to.be(true);
      });
    });

    describe('count', function() {
      var result = queryDef.isPipelineAgg('count');

      it('is not pipe line metric', function() {
        expect(result).to.be(false);
      });
    });
  });

  describe('pipeline aggs depending on esverison', function() {
      describe('using esversion undefined', function() {
          it('should not get pipeline aggs', function() {
              expect(queryDef.getMetricAggTypes(undefined).length).to.be(9);
          });
      });

      describe('using esversion 1', function() {
          it('should not get pipeline aggs', function() {
              expect(queryDef.getMetricAggTypes(1).length).to.be(9);
          });
      });

      describe('using esversion 2', function() {
          it('should get pipeline aggs', function() {
              expect(queryDef.getMetricAggTypes(2).length).to.be(11);
          });
      });
  });
});
