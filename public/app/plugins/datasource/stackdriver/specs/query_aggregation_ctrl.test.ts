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
          expect(ctrl.$scope.aggOptions.length).toBe(11);
          expect(ctrl.$scope.aggOptions.map(o => o.value)).toEqual(
            expect.not.arrayContaining(['REDUCE_COUNT_TRUE', 'REDUCE_COUNT_FALSE'])
          );
        });

        it('should populate all alignment options except two', () => {
          ctrl.setAlignOptions();
          expect(ctrl.$scope.alignOptions.length).toBe(10);
          expect(ctrl.$scope.alignOptions.map(o => o.value)).toEqual(
            expect.not.arrayContaining(['REDUCE_COUNT_TRUE', 'REDUCE_COUNT_FALSE'])
          );
        });
      });
    });

    describe('when a user selects ALIGN_NONE and a reducer is selected', () => {
      beforeEach(async () => {
        ctrl = new StackdriverAggregationCtrl({
          $on: () => {},
          refresh: () => {},
          target: { aggregation: { crossSeriesReducer: 'RANDOM_REDUCER' } },
        });
        ctrl.onAlignmentChange('ALIGN_NONE');
      });
      it('should set REDUCE_NONE as selected aggregation', () => {
        expect(ctrl.$scope.target.aggregation.crossSeriesReducer).toBe('REDUCE_NONE');
      });
    });

    describe('when a user a user select a reducer and no alignment is selected', () => {
      beforeEach(async () => {
        ctrl = new StackdriverAggregationCtrl({
          $on: () => {},
          refresh: () => {},
          target: { aggregation: { crossSeriesReducer: 'REDUCE_NONE', perSeriesAligner: 'ALIGN_NONE' } },
        });
        ctrl.onAggregationChange('ALIGN_NONE');
      });

      it('should set an alignment', () => {
        expect(ctrl.$scope.target.aggregation.perSeriesAligner).not.toBe('ALIGN_NONE');
      });
    });
  });
});
