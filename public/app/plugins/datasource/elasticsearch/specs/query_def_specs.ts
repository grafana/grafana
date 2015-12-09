///<amd-dependency path="../query_def" name="QueryDef" />
///<amd-dependency path="test/specs/helpers" name="helpers" />

import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

declare var helpers: any;
declare var QueryDef: any;

describe('ElasticQueryDef', function() {

  describe('getMovingAverageOptions', function() {
    describe('with zero targets', function() {
      var response = QueryDef.getMovingAverageOptions([]);

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

      var response = QueryDef.getMovingAverageOptions(targets);

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

      var response = QueryDef.getMovingAverageOptions(targets);

      it('should return zero', function() {
        expect(response.length).to.be(1);
      });
    });
  });

  describe('isPipelineMetric', function() {
    describe('moving_avg', function() {
      var result = QueryDef.isPipelineAgg({ type: 'moving_avg' });

      it('is pipe line metric', function() {
        expect(result).to.be(true);
      });
    });

    describe('count', function() {
      var result = QueryDef.isPipelineAgg({ type: 'count' });

      it('is not pipe line metric', function() {
        expect(result).to.be(false);
      });
    });
  });
});
