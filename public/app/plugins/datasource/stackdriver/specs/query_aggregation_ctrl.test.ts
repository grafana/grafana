import { StackdriverAggregationCtrl } from '../query_aggregation_ctrl';

describe('StackdriverAggregationCtrl', () => {
  let ctrl;
  describe('aggregation and alignment options', () => {
    beforeEach(() => {
      ctrl = createCtrlWithFakes();
    });
    describe('when new query result is returned from the server', () => {
      describe('and result is double and gauge', () => {
        beforeEach(async () => {
          ctrl.target.valueType = 'DOUBLE';
          ctrl.target.metricKind = 'GAUGE';
        });

        it('should populate all aggregate options except two', () => {
          const result = ctrl.getAggOptions();
          expect(result.length).toBe(11);
          expect(result.map(o => o.value)).toEqual(
            expect.not.arrayContaining(['REDUCE_COUNT_TRUE', 'REDUCE_COUNT_FALSE'])
          );
        });

        it('should populate all alignment options except two', () => {
          const result = ctrl.getAlignOptions();
          console.log(result.map(o => o.value));
          expect(result.length).toBe(10);
          expect(result.map(o => o.value)).toEqual(
            expect.not.arrayContaining(['REDUCE_COUNT_TRUE', 'REDUCE_COUNT_FALSE'])
          );
        });
      });
    });

    describe('when a user a user select ALIGN_NONE and a reducer is selected', () => {
      beforeEach(async () => {
        ctrl.target.aggregation.crossSeriesReducer = 'RANDOM_REDUCER';
        ctrl.onAlignmentChange('ALIGN_NONE');
      });
      it('should set REDUCE_NONE as selected aggregation', () => {
        expect(ctrl.target.aggregation.crossSeriesReducer).toBe('REDUCE_NONE');
      });
    });

    describe('when a user a user select a reducer and no alignment is selected', () => {
      beforeEach(async () => {
        ctrl.target.aggregation.crossSeriesReducer = 'REDUCE_NONE';
        ctrl.target.aggregation.perSeriesAligner = 'ALIGN_NONE';
        ctrl.onAggregationChange('ALIGN_NONE');
      });

      it('should set an alignment', () => {
        expect(ctrl.target.aggregation.perSeriesAligner).not.toBe('ALIGN_NONE');
      });
    });
  });
});

function createCtrlWithFakes() {
  StackdriverAggregationCtrl.prototype.target = createTarget();
  return new StackdriverAggregationCtrl({ refresh: () => {} });
}

function createTarget(existingFilters?: string[]) {
  return {
    project: {
      id: '',
      name: '',
    },
    metricType: 'ametric',
    refId: 'A',
    aggregation: {
      crossSeriesReducer: '',
      alignmentPeriod: '',
      perSeriesAligner: '',
      groupBys: [],
    },
    filters: existingFilters || [],
    aliasBy: '',
  };
}
