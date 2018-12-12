import { StackdriverAggregationCtrl } from '../query_aggregation_ctrl';

describe('StackdriverAggregationCtrl', () => {
  let ctrl;
  describe('aggregation and alignment options', () => {
    describe('when new query result is returned from the server', () => {
      describe('and result is double and gauge and no group by is used', () => {
        beforeEach(async () => {
          ctrl = new StackdriverAggregationCtrl(
            {
              $on: () => {},
              target: {
                valueType: 'DOUBLE',
                metricKind: 'GAUGE',
                aggregation: { crossSeriesReducer: '', groupBys: [] },
              },
            },
            {
              replace: s => s,
              variables: [{ name: 'someVariable1' }, { name: 'someVariable2' }],
            }
          );
        });

        it('should populate all aggregate options except two', () => {
          ctrl.setAggOptions();
          expect(ctrl.aggOptions.length).toBe(2);
          const [templateVariableGroup, aggOptionsGroup] = ctrl.aggOptions;
          expect(templateVariableGroup.options.length).toBe(2);
          expect(aggOptionsGroup.options.length).toBe(11);
          expect(aggOptionsGroup.options.map(o => o.value)).toEqual(
            expect['not'].arrayContaining(['REDUCE_COUNT_TRUE', 'REDUCE_COUNT_FALSE'])
          );
        });

        it('should populate all alignment options except two', () => {
          ctrl.setAlignOptions();
          const [templateVariableGroup, alignOptionGroup] = ctrl.aggOptions;
          expect(templateVariableGroup.options.length).toBe(2);
          expect(alignOptionGroup.options.length).toBe(11);
          expect(alignOptionGroup.options.map(o => o.value)).toEqual(
            expect['not'].arrayContaining(['REDUCE_COUNT_TRUE', 'REDUCE_COUNT_FALSE'])
          );
        });
      });

      describe('and result is double and delta and no group by is used', () => {
        beforeEach(async () => {
          ctrl = new StackdriverAggregationCtrl(
            {
              $on: () => {},
              target: {
                valueType: 'DOUBLE',
                metricKind: 'DELTA',
                aggregation: { crossSeriesReducer: '', groupBys: [] },
              },
            },
            {
              replace: s => s,
              variables: [{ name: 'someVariable1' }, { name: 'someVariable2' }],
            }
          );
        });

        it('should populate all alignment options except four', () => {
          ctrl.setAlignOptions();
          const [templateVariableGroup, alignOptionGroup] = ctrl.alignOptions;
          expect(templateVariableGroup.options.length).toBe(2);
          expect(alignOptionGroup.options.length).toBe(9);
          expect(alignOptionGroup.options.map(o => o.value)).toEqual(
            expect['not'].arrayContaining([
              'ALIGN_NEXT_OLDER',
              'ALIGN_INTERPOLATE',
              'ALIGN_COUNT_TRUE',
              'ALIGN_COUNT_FALSE',
              'ALIGN_FRACTION_TRUE',
            ])
          );
        });
      });

      describe('and result is double and gauge and a group by is used', () => {
        beforeEach(async () => {
          ctrl = new StackdriverAggregationCtrl(
            {
              $on: () => {},
              target: {
                valueType: 'DOUBLE',
                metricKind: 'GAUGE',
                aggregation: { crossSeriesReducer: 'REDUCE_NONE', groupBys: ['resource.label.projectid'] },
              },
            },
            {
              replace: s => s,
              variables: [{ name: 'someVariable1' }],
            }
          );
        });

        it('should populate all aggregate options except three', () => {
          ctrl.setAggOptions();
          const [templateVariableGroup, aggOptionsGroup] = ctrl.aggOptions;
          expect(ctrl.aggOptions.length).toBe(2);
          expect(templateVariableGroup.options.length).toBe(1);
          expect(aggOptionsGroup.options.length).toBe(10);
          expect(aggOptionsGroup.options.map(o => o.value)).toEqual(
            expect['not'].arrayContaining(['REDUCE_COUNT_TRUE', 'REDUCE_COUNT_FALSE', 'REDUCE_NONE'])
          );
        });

        it('should select some other reducer than REDUCE_NONE', () => {
          ctrl.setAggOptions();
          expect(ctrl.target.aggregation.crossSeriesReducer).not.toBe('');
          expect(ctrl.target.aggregation.crossSeriesReducer).not.toBe('REDUCE_NONE');
        });
      });
    });
  });
});
