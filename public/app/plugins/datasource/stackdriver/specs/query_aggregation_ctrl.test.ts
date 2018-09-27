import { StackdriverAggregationCtrl } from '../query_aggregation_ctrl';

describe('StackdriverAggregationCtrl', () => {
  let ctrl;
  describe('aggregation and alignment options', () => {
    describe('when new query result is returned from the server', () => {
      describe('and result is double and gauge', () => {
        beforeEach(async () => {
          ctrl = new StackdriverAggregationCtrl({
            $on: () => {},
            target: { valueType: 'DOUBLE', metricKind: 'GAUGE', aggregation: { crossSeriesReducer: '' } },
          });
        });

        it('should populate all aggregate options except two', () => {
          ctrl.setAggOptions();
          expect(ctrl.aggOptions.length).toBe(11);
          expect(ctrl.aggOptions.map(o => o.value)).toEqual(
            expect['not'].arrayContaining(['REDUCE_COUNT_TRUE', 'REDUCE_COUNT_FALSE'])
          );
        });

        it('should populate all alignment options except two', () => {
          ctrl.setAlignOptions();
          expect(ctrl.alignOptions.length).toBe(9);
          expect(ctrl.alignOptions.map(o => o.value)).toEqual(
            expect['not'].arrayContaining(['REDUCE_COUNT_TRUE', 'REDUCE_COUNT_FALSE'])
          );
        });
      });
    });
  });
});
