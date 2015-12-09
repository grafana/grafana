///<amd-dependency path="../query_def" name="QueryDef" />
///<amd-dependency path="test/specs/helpers" name="helpers" />

import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

declare var helpers: any;
declare var QueryDef: any;

describe('ElasticQueryDef', function() {

  describe('with zero targets', function() {
    var response = QueryDef.getMovingAverageSourceOptions([]);

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

    var response = QueryDef.getMovingAverageSourceOptions(targets);

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

    var response = QueryDef.getMovingAverageSourceOptions(targets);

    it('should return zero', function() {
      expect(response.length).to.be(1);
    });
  });
});
