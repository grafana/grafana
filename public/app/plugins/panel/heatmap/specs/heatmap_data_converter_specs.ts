///<reference path="../../../../headers/common.d.ts" />

import _ from 'lodash';
import { describe, beforeEach, it, sinon, expect, angularMocks } from '../../../../../test/lib/common';
import TimeSeries from 'app/core/time_series2';
import {convertToHeatMap, convertToCards, elasticHistogramToHeatmap,
        calculateBucketSize, isHeatmapDataEqual} from '../heatmap_data_converter';

describe('isHeatmapDataEqual', () => {
  let ctx: any = {};

  beforeEach(() => {
    ctx.heatmapA = {
      '1422774000000': {
        x: 1422774000000,
        buckets: {
          '1': { y: 1, values: [1, 1.5] },
          '2': { y: 2, values: [1] }
        }
      }
    };

    ctx.heatmapB = {
      '1422774000000': {
        x: 1422774000000,
        buckets: {
          '1': { y: 1, values: [1.5, 1] },
          '2': { y: 2, values: [1] }
        }
      }
    };
  });

  it('should proper compare objects', () => {
    let heatmapC = _.cloneDeep(ctx.heatmapA);
    heatmapC['1422774000000'].buckets['1'].values = [1, 1.5];

    let heatmapD = _.cloneDeep(ctx.heatmapA);
    heatmapD['1422774000000'].buckets['1'].values = [1.5, 1, 1.6];

    let heatmapE = _.cloneDeep(ctx.heatmapA);
    heatmapE['1422774000000'].buckets['1'].values = [1, 1.6];

    let empty = {};
    let emptyValues = _.cloneDeep(ctx.heatmapA);
    emptyValues['1422774000000'].buckets['1'].values = [];

    expect(isHeatmapDataEqual(ctx.heatmapA, ctx.heatmapB)).to.be(true);
    expect(isHeatmapDataEqual(ctx.heatmapB, ctx.heatmapA)).to.be(true);

    expect(isHeatmapDataEqual(ctx.heatmapA, heatmapC)).to.be(true);
    expect(isHeatmapDataEqual(heatmapC, ctx.heatmapA)).to.be(true);

    expect(isHeatmapDataEqual(ctx.heatmapA, heatmapD)).to.be(false);
    expect(isHeatmapDataEqual(heatmapD, ctx.heatmapA)).to.be(false);

    expect(isHeatmapDataEqual(ctx.heatmapA, heatmapE)).to.be(false);
    expect(isHeatmapDataEqual(heatmapE, ctx.heatmapA)).to.be(false);

    expect(isHeatmapDataEqual(empty, ctx.heatmapA)).to.be(false);
    expect(isHeatmapDataEqual(ctx.heatmapA, empty)).to.be(false);

    expect(isHeatmapDataEqual(emptyValues, ctx.heatmapA)).to.be(false);
    expect(isHeatmapDataEqual(ctx.heatmapA, emptyValues)).to.be(false);
  });
});

describe('calculateBucketSize', () => {
  let ctx: any = {};

  describe('when logBase is 1 (linear scale)', () => {

    beforeEach(() => {
      ctx.logBase = 1;
      ctx.bounds_set = [
        { bounds: [], size: 0 },
        { bounds: [0], size: 0 },
        { bounds: [4], size: 4 },
        { bounds: [0, 1, 2, 3, 4], size: 1 },
        { bounds: [0, 1, 3, 5, 7], size: 1 },
        { bounds: [0, 3, 7, 9, 15], size: 2 },
        { bounds: [0, 7, 3, 15, 9], size: 2 },
        { bounds: [0, 5, 10, 15, 50], size: 5 }
      ];
    });

    it('should properly calculate bucket size', () => {
      _.each(ctx.bounds_set, (b) => {
        let bucketSize = calculateBucketSize(b.bounds, ctx.logBase);
        expect(bucketSize).to.be(b.size);
      });
    });
  });

  describe('when logBase is 2', () => {

    beforeEach(() => {
      ctx.logBase = 2;
      ctx.bounds_set = [
        { bounds: [], size: 0 },
        { bounds: [0], size: 0 },
        { bounds: [4], size: 4 },
        { bounds: [1, 2, 4, 8], size: 1 },
        { bounds: [1, Math.SQRT2, 2, 8, 16], size: 0.5 }
      ];
    });

    it('should properly calculate bucket size', () => {
      _.each(ctx.bounds_set, (b) => {
        let bucketSize = calculateBucketSize(b.bounds, ctx.logBase);
        expect(isEqual(bucketSize, b.size)).to.be(true);
      });
    });
  });
});

describe('HeatmapDataConverter', () => {
  let ctx: any = {};

  beforeEach(() => {
    ctx.series = [];
    ctx.series.push(new TimeSeries({
      datapoints: [[1, 1422774000000], [1, 1422774000010], [2, 1422774060000]],
      alias: 'series1'
    }));
    ctx.series.push(new TimeSeries({
      datapoints: [[2, 1422774000000], [2, 1422774000010], [3, 1422774060000]],
      alias: 'series2'
    }));
    ctx.series.push(new TimeSeries({
      datapoints: [[5, 1422774000000], [3, 1422774000010], [4, 1422774060000]],
      alias: 'series3'
    }));

    ctx.xBucketSize = 60000; // 60s
    ctx.yBucketSize = 2;
    ctx.logBase = 1;
  });

  describe('when logBase is 1 (linear scale)', () => {
    beforeEach(() => {
      ctx.logBase = 1;
    });

    it('should build proper heatmap data', () => {
      let expectedHeatmap = {
        '1422774000000': {
          x: 1422774000000,
          buckets: {
            '0': {y: 0, values: [1, 1], count: 2, bounds: {bottom: 0, top: 2}},
            '2': {y: 2, values: [2, 2, 3], count: 3, bounds: {bottom: 2, top: 4}},
            '4': {y: 4, values: [5], count: 1, bounds: {bottom: 4, top: 6}},
          }
        },
        '1422774060000': {
          x: 1422774060000,
          buckets: {
            '2': {y: 2, values: [2, 3], count: 3, bounds: {bottom: 2, top: 4}},
            '4': {y: 4, values: [4], count: 1, bounds: {bottom: 4, top: 6}},
          }
        },
      };

      let heatmap = convertToHeatMap(ctx.series, ctx.yBucketSize, ctx.xBucketSize, ctx.logBase);
      expect(isHeatmapDataEqual(heatmap, expectedHeatmap)).to.be(true);
    });
  });

  describe.skip('when logBase is 2', () => {

    beforeEach(() => {
      ctx.logBase = 2;
    });

    it('should build proper heatmap data', () => {
      let expectedHeatmap = {
        '1422774000000': {
          x: 1422774000000,
          buckets: {
            '1': { y: 1, values: [1] },
            '2': { y: 2, values: [2] }
          }
        },
        '1422774060000': {
          x: 1422774060000,
          buckets: {
            '2': { y: 2, values: [2, 3] }
          }
        },
      };

      let heatmap = convertToHeatMap(ctx.series, ctx.yBucketSize, ctx.xBucketSize, ctx.logBase);
      expect(isHeatmapDataEqual(heatmap, expectedHeatmap)).to.be(true);
    });
  });
});

describe('ES Histogram converter', () => {
  let ctx: any = {};

  beforeEach(() => {
    ctx.series = [];
    ctx.series.push(new TimeSeries({
      datapoints: [[1, 1422774000000], [0, 1422774060000]],
      alias: '1', label: '1'
    }));
    ctx.series.push(new TimeSeries({
      datapoints: [[5, 1422774000000], [3, 1422774060000]],
      alias: '2', label: '2'
    }));
    ctx.series.push(new TimeSeries({
      datapoints: [[0, 1422774000000], [1, 1422774060000]],
      alias: '3', label: '3'
    }));
  });

  describe('when converting ES histogram', () => {

    beforeEach(() => {
    });

    it('should build proper heatmap data', () => {
      let expectedHeatmap = {
        '1422774000000': {
          x: 1422774000000,
          buckets: {
            '1': { y: 1, count: 1, values: [], points: [] },
            '2': { y: 2, count: 5, values: [], points: [] },
            '3': { y: 3, count: 0, values: [], points: [] }
          }
        },
        '1422774060000': {
          x: 1422774060000,
          buckets: {
            '1': { y: 1, count: 0, values: [], points: [] },
            '2': { y: 2, count: 3, values: [], points: [] },
            '3': { y: 3, count: 1, values: [], points: [] }
          }
        },
      };

      let heatmap = elasticHistogramToHeatmap(ctx.series);
      expect(heatmap).to.eql(expectedHeatmap);
    });
  });
});

describe('convertToCards', () => {
  let buckets = {};

  beforeEach(() => {
    buckets = {
      '1422774000000': {
        x: 1422774000000,
        buckets: {
          '1': { y: 1, values: [1], count: 1, bounds: {} },
          '2': { y: 2, values: [2], count: 1, bounds: {} }
        }
      },
      '1422774060000': {
        x: 1422774060000,
        buckets: {
          '2': { y: 2, values: [2, 3], count: 2, bounds: {} }
        }
      },
    };
  });

  it('should build proper cards data', () => {
    let expectedCards = [
      {x: 1422774000000, y: 1, count: 1, values: [1], yBounds: {}},
      {x: 1422774000000, y: 2, count: 1, values: [2], yBounds: {}},
      {x: 1422774060000, y: 2, count: 2, values: [2, 3], yBounds: {}}
    ];
    let {cards, cardStats} = convertToCards(buckets);
    expect(cards).to.eql(expectedCards);
  });

  it('should build proper cards stats', () => {
    let expectedStats = {
      min: 1,
      max: 2
    };
    let {cards, cardStats} = convertToCards(buckets);
    expect(cardStats).to.eql(expectedStats);
  });
});

/**
 * Compare two numbers with given precision. Suitable for compare float numbers after conversions with precision loss.
 * @param a
 * @param b
 * @param precision
 */
function isEqual(a: number, b: number, precision = 0.000001): boolean {
  if (a === b) {
    return true;
  } else {
    return Math.abs(1 - a / b) <= precision;
  }
}
