import { getAlignmentOptionsByMetric } from './functions';
import { ValueTypes, MetricKind } from './constants';

describe('functions', () => {
  let result: any;
  describe('getAlignmentOptionsByMetric', () => {
    describe('when double and gauge is passed', () => {
      beforeEach(() => {
        result = getAlignmentOptionsByMetric(ValueTypes.DOUBLE, MetricKind.GAUGE);
      });

      it('should return all alignment options except two', () => {
        expect(result.length).toBe(9);
        expect(result.map((o: any) => o.value)).toEqual(
          expect.not.arrayContaining(['REDUCE_COUNT_TRUE', 'REDUCE_COUNT_FALSE'])
        );
      });
    });

    describe('when double and delta is passed', () => {
      beforeEach(() => {
        result = getAlignmentOptionsByMetric(ValueTypes.DOUBLE, MetricKind.DELTA);
      });

      it('should return all alignment options except four', () => {
        expect(result.length).toBe(9);
        expect(result.map((o: any) => o.value)).toEqual(
          expect.not.arrayContaining([
            'ALIGN_COUNT_TRUE',
            'ALIGN_COUNT_FALSE',
            'ALIGN_FRACTION_TRUE',
            'ALIGN_INTERPOLATE',
          ])
        );
      });
    });
  });
});
