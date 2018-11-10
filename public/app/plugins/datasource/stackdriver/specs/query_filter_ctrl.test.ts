import { StackdriverFilterCtrl } from '../query_filter_ctrl';
import { TemplateSrvStub } from 'test/specs/helpers';
import { DefaultRemoveFilterValue, DefaultFilterValue } from '../filter_segments';

describe('StackdriverQueryFilterCtrl', () => {
  let ctrl;
  let result;

  describe('when initializing query editor', () => {
    beforeEach(() => {
      const existingFilters = ['key1', '=', 'val1', 'AND', 'key2', '=', 'val2'];
      ctrl = createCtrlWithFakes(existingFilters);
    });

    it('should initialize filter segments using the target filter values', () => {
      expect(ctrl.filterSegments.filterSegments.length).toBe(8);
      expect(ctrl.filterSegments.filterSegments[0].type).toBe('key');
      expect(ctrl.filterSegments.filterSegments[1].type).toBe('operator');
      expect(ctrl.filterSegments.filterSegments[2].type).toBe('value');
      expect(ctrl.filterSegments.filterSegments[3].type).toBe('condition');
      expect(ctrl.filterSegments.filterSegments[4].type).toBe('key');
      expect(ctrl.filterSegments.filterSegments[5].type).toBe('operator');
      expect(ctrl.filterSegments.filterSegments[6].type).toBe('value');
      expect(ctrl.filterSegments.filterSegments[7].type).toBe('plus-button');
    });
  });

  describe('group bys', () => {
    beforeEach(() => {
      ctrl = createCtrlWithFakes();
    });

    describe('when labels are fetched', () => {
      beforeEach(async () => {
        ctrl.metricLabels = { 'metric-key-1': ['metric-value-1'] };
        ctrl.resourceLabels = { 'resource-key-1': ['resource-value-1'] };

        result = await ctrl.getGroupBys();
      });

      it('should populate group bys segments', () => {
        expect(result.length).toBe(3);
        expect(result[0].value).toBe('metric.label.metric-key-1');
        expect(result[1].value).toBe('resource.label.resource-key-1');
        expect(result[2].value).toBe('-- remove group by --');
      });
    });

    describe('when a group by label is selected', () => {
      beforeEach(async () => {
        ctrl.metricLabels = {
          'metric-key-1': ['metric-value-1'],
          'metric-key-2': ['metric-value-2'],
        };
        ctrl.resourceLabels = {
          'resource-key-1': ['resource-value-1'],
          'resource-key-2': ['resource-value-2'],
        };
        ctrl.target.aggregation.groupBys = ['metric.label.metric-key-1', 'resource.label.resource-key-1'];

        result = await ctrl.getGroupBys();
      });

      it('should not be used to populate group bys segments', () => {
        expect(result.length).toBe(3);
        expect(result[0].value).toBe('metric.label.metric-key-2');
        expect(result[1].value).toBe('resource.label.resource-key-2');
        expect(result[2].value).toBe('-- remove group by --');
      });
    });

    describe('when a group by is selected', () => {
      beforeEach(() => {
        const removeSegment = { fake: true, value: '-- remove group by --' };
        const segment = { value: 'groupby1' };
        ctrl.groupBySegments = [segment, removeSegment];
        ctrl.groupByChanged(segment);
      });

      it('should be added to group bys list', () => {
        expect(ctrl.target.aggregation.groupBys.length).toBe(1);
      });
    });

    describe('when a selected group by is removed', () => {
      beforeEach(() => {
        const removeSegment = { fake: true, value: '-- remove group by --' };
        const segment = { value: 'groupby1' };
        ctrl.groupBySegments = [segment, removeSegment];
        ctrl.groupByChanged(removeSegment);
      });

      it('should be added to group bys list', () => {
        expect(ctrl.target.aggregation.groupBys.length).toBe(0);
      });
    });
  });

  describe('filters', () => {
    beforeEach(() => {
      ctrl = createCtrlWithFakes();
    });

    describe('when values for a condition filter part are fetched', () => {
      beforeEach(async () => {
        const segment = { type: 'condition' };
        result = await ctrl.getFilters(segment, 0);
      });

      it('should populate condition segments', () => {
        expect(result.length).toBe(1);
        expect(result[0].value).toBe('AND');
      });
    });

    describe('when values for a operator filter part are fetched', () => {
      beforeEach(async () => {
        const segment = { type: 'operator' };
        result = await ctrl.getFilters(segment, 0);
      });

      it('should populate group bys segments', () => {
        expect(result.length).toBe(4);
        expect(result[0].value).toBe('=');
        expect(result[1].value).toBe('!=');
        expect(result[2].value).toBe('=~');
        expect(result[3].value).toBe('!=~');
      });
    });

    describe('when values for a key filter part are fetched', () => {
      beforeEach(async () => {
        ctrl.metricLabels = {
          'metric-key-1': ['metric-value-1'],
          'metric-key-2': ['metric-value-2'],
        };
        ctrl.resourceLabels = {
          'resource-key-1': ['resource-value-1'],
          'resource-key-2': ['resource-value-2'],
        };

        const segment = { type: 'key' };
        result = await ctrl.getFilters(segment, 0);
      });

      it('should populate filter key segments', () => {
        expect(result.length).toBe(5);
        expect(result[0].value).toBe('metric.label.metric-key-1');
        expect(result[1].value).toBe('metric.label.metric-key-2');
        expect(result[2].value).toBe('resource.label.resource-key-1');
        expect(result[3].value).toBe('resource.label.resource-key-2');
        expect(result[4].value).toBe('-- remove filter --');
      });
    });

    describe('when values for a value filter part are fetched', () => {
      beforeEach(async () => {
        ctrl.metricLabels = {
          'metric-key-1': ['metric-value-1'],
          'metric-key-2': ['metric-value-2'],
        };
        ctrl.resourceLabels = {
          'resource-key-1': ['resource-value-1'],
          'resource-key-2': ['resource-value-2'],
        };

        ctrl.filterSegments.filterSegments = [
          { type: 'key', value: 'metric.label.metric-key-1' },
          { type: 'operator', value: '=' },
        ];

        const segment = { type: 'value' };
        result = await ctrl.getFilters(segment, 2);
      });

      it('should populate filter value segments', () => {
        expect(result.length).toBe(1);
        expect(result[0].value).toBe('metric-value-1');
      });
    });

    describe('when a filter is created by clicking on plus button', () => {
      describe('and there are no other filters', () => {
        beforeEach(() => {
          const segment = { value: 'filterkey1', type: 'plus-button' };
          ctrl.filterSegments.filterSegments = [segment];
          ctrl.filterSegmentUpdated(segment, 0);
        });

        it('should transform the plus button segment to a key segment', () => {
          expect(ctrl.filterSegments.filterSegments[0].type).toBe('key');
        });

        it('should add an operator, value segment and plus button segment', () => {
          expect(ctrl.filterSegments.filterSegments.length).toBe(3);
          expect(ctrl.filterSegments.filterSegments[1].type).toBe('operator');
          expect(ctrl.filterSegments.filterSegments[2].type).toBe('value');
        });
      });
    });
    describe('when has one existing filter', () => {
      describe('and user clicks on key segment', () => {
        beforeEach(() => {
          const existingKeySegment = { value: 'filterkey1', type: 'key' };
          const existingOperatorSegment = { value: '=', type: 'operator' };
          const existingValueSegment = { value: 'filtervalue', type: 'value' };
          const plusSegment = { value: '', type: 'plus-button' };
          ctrl.filterSegments.filterSegments = [
            existingKeySegment,
            existingOperatorSegment,
            existingValueSegment,
            plusSegment,
          ];
          ctrl.filterSegmentUpdated(existingKeySegment, 0);
        });

        it('should not add any new segments', () => {
          expect(ctrl.filterSegments.filterSegments.length).toBe(4);
          expect(ctrl.filterSegments.filterSegments[0].type).toBe('key');
          expect(ctrl.filterSegments.filterSegments[1].type).toBe('operator');
          expect(ctrl.filterSegments.filterSegments[2].type).toBe('value');
        });
      });
      describe('and user clicks on value segment and value not equal to fake value', () => {
        beforeEach(() => {
          const existingKeySegment = { value: 'filterkey1', type: 'key' };
          const existingOperatorSegment = { value: '=', type: 'operator' };
          const existingValueSegment = { value: 'filtervalue', type: 'value' };
          ctrl.filterSegments.filterSegments = [existingKeySegment, existingOperatorSegment, existingValueSegment];
          ctrl.filterSegmentUpdated(existingValueSegment, 2);
        });

        it('should ensure that plus segment exists', () => {
          expect(ctrl.filterSegments.filterSegments.length).toBe(4);
          expect(ctrl.filterSegments.filterSegments[0].type).toBe('key');
          expect(ctrl.filterSegments.filterSegments[1].type).toBe('operator');
          expect(ctrl.filterSegments.filterSegments[2].type).toBe('value');
          expect(ctrl.filterSegments.filterSegments[3].type).toBe('plus-button');
        });
      });

      describe('and user clicks on value segment and value is equal to fake value', () => {
        beforeEach(() => {
          const existingKeySegment = { value: 'filterkey1', type: 'key' };
          const existingOperatorSegment = { value: '=', type: 'operator' };
          const existingValueSegment = { value: DefaultFilterValue, type: 'value' };
          ctrl.filterSegments.filterSegments = [existingKeySegment, existingOperatorSegment, existingValueSegment];
          ctrl.filterSegmentUpdated(existingValueSegment, 2);
        });

        it('should not add plus segment', () => {
          expect(ctrl.filterSegments.filterSegments.length).toBe(3);
          expect(ctrl.filterSegments.filterSegments[0].type).toBe('key');
          expect(ctrl.filterSegments.filterSegments[1].type).toBe('operator');
          expect(ctrl.filterSegments.filterSegments[2].type).toBe('value');
        });
      });
      describe('and user removes key segment', () => {
        beforeEach(() => {
          const existingKeySegment = { value: DefaultRemoveFilterValue, type: 'key' };
          const existingOperatorSegment = { value: '=', type: 'operator' };
          const existingValueSegment = { value: 'filtervalue', type: 'value' };
          const plusSegment = { value: '', type: 'plus-button' };
          ctrl.filterSegments.filterSegments = [
            existingKeySegment,
            existingOperatorSegment,
            existingValueSegment,
            plusSegment,
          ];
          ctrl.filterSegmentUpdated(existingKeySegment, 0);
        });

        it('should remove filter segments', () => {
          expect(ctrl.filterSegments.filterSegments.length).toBe(1);
          expect(ctrl.filterSegments.filterSegments[0].type).toBe('plus-button');
        });
      });

      describe('and user removes key segment and there is a previous filter', () => {
        beforeEach(() => {
          const existingKeySegment1 = { value: DefaultRemoveFilterValue, type: 'key' };
          const existingKeySegment2 = { value: DefaultRemoveFilterValue, type: 'key' };
          const existingOperatorSegment = { value: '=', type: 'operator' };
          const existingValueSegment = { value: 'filtervalue', type: 'value' };
          const conditionSegment = { value: 'AND', type: 'condition' };
          const plusSegment = { value: '', type: 'plus-button' };
          ctrl.filterSegments.filterSegments = [
            existingKeySegment1,
            existingOperatorSegment,
            existingValueSegment,
            conditionSegment,
            existingKeySegment2,
            Object.assign({}, existingOperatorSegment),
            Object.assign({}, existingValueSegment),
            plusSegment,
          ];
          ctrl.filterSegmentUpdated(existingKeySegment2, 4);
        });

        it('should remove filter segments and the condition segment', () => {
          expect(ctrl.filterSegments.filterSegments.length).toBe(4);
          expect(ctrl.filterSegments.filterSegments[0].type).toBe('key');
          expect(ctrl.filterSegments.filterSegments[1].type).toBe('operator');
          expect(ctrl.filterSegments.filterSegments[2].type).toBe('value');
          expect(ctrl.filterSegments.filterSegments[3].type).toBe('plus-button');
        });
      });

      describe('and user removes key segment and there is a filter after it', () => {
        beforeEach(() => {
          const existingKeySegment1 = { value: DefaultRemoveFilterValue, type: 'key' };
          const existingKeySegment2 = { value: DefaultRemoveFilterValue, type: 'key' };
          const existingOperatorSegment = { value: '=', type: 'operator' };
          const existingValueSegment = { value: 'filtervalue', type: 'value' };
          const conditionSegment = { value: 'AND', type: 'condition' };
          const plusSegment = { value: '', type: 'plus-button' };
          ctrl.filterSegments.filterSegments = [
            existingKeySegment1,
            existingOperatorSegment,
            existingValueSegment,
            conditionSegment,
            existingKeySegment2,
            Object.assign({}, existingOperatorSegment),
            Object.assign({}, existingValueSegment),
            plusSegment,
          ];
          ctrl.filterSegmentUpdated(existingKeySegment1, 0);
        });

        it('should remove filter segments and the condition segment', () => {
          expect(ctrl.filterSegments.filterSegments.length).toBe(4);
          expect(ctrl.filterSegments.filterSegments[0].type).toBe('key');
          expect(ctrl.filterSegments.filterSegments[1].type).toBe('operator');
          expect(ctrl.filterSegments.filterSegments[2].type).toBe('value');
          expect(ctrl.filterSegments.filterSegments[3].type).toBe('plus-button');
        });
      });

      describe('and user clicks on plus button', () => {
        beforeEach(() => {
          const existingKeySegment = { value: 'filterkey1', type: 'key' };
          const existingOperatorSegment = { value: '=', type: 'operator' };
          const existingValueSegment = { value: 'filtervalue', type: 'value' };
          const plusSegment = { value: 'filterkey2', type: 'plus-button' };
          ctrl.filterSegments.filterSegments = [
            existingKeySegment,
            existingOperatorSegment,
            existingValueSegment,
            plusSegment,
          ];
          ctrl.filterSegmentUpdated(plusSegment, 3);
        });

        it('should condition segment and new filter segments', () => {
          expect(ctrl.filterSegments.filterSegments.length).toBe(7);
          expect(ctrl.filterSegments.filterSegments[0].type).toBe('key');
          expect(ctrl.filterSegments.filterSegments[1].type).toBe('operator');
          expect(ctrl.filterSegments.filterSegments[2].type).toBe('value');
          expect(ctrl.filterSegments.filterSegments[3].type).toBe('condition');
          expect(ctrl.filterSegments.filterSegments[4].type).toBe('key');
          expect(ctrl.filterSegments.filterSegments[5].type).toBe('operator');
          expect(ctrl.filterSegments.filterSegments[6].type).toBe('value');
        });
      });
    });
  });
});

function createCtrlWithFakes(existingFilters?: string[]) {
  StackdriverFilterCtrl.prototype.loadMetricDescriptors = () => {
    return Promise.resolve([]);
  };
  StackdriverFilterCtrl.prototype.getLabels = () => {
    return Promise.resolve();
  };

  const fakeSegmentServer = {
    newKey: val => {
      return { value: val, type: 'key' };
    },
    newKeyValue: val => {
      return { value: val, type: 'value' };
    },
    newSegment: obj => {
      return { value: obj.value ? obj.value : obj };
    },
    newOperators: ops => {
      return ops.map(o => {
        return { type: 'operator', value: o };
      });
    },
    newFake: (value, type, cssClass) => {
      return { value, type, cssClass };
    },
    newOperator: op => {
      return { value: op, type: 'operator' };
    },
    newPlusButton: () => {
      return { type: 'plus-button' };
    },
    newCondition: val => {
      return { type: 'condition', value: val };
    },
  };
  const scope = {
    target: createTarget(existingFilters),
    datasource: {
      getDefaultProject: () => {
        return 'project';
      },
    },
    defaultDropdownValue: 'Select Metric',
    defaultServiceValue: 'All Services',
    refresh: () => {},
  };

  return new StackdriverFilterCtrl(scope, fakeSegmentServer, new TemplateSrvStub(), { $broadcast: param => {} });
}

function createTarget(existingFilters?: string[]) {
  return {
    project: {
      id: '',
      name: '',
    },
    unit: '',
    metricType: 'ametric',
    service: '',
    refId: 'A',
    aggregation: {
      crossSeriesReducer: '',
      alignmentPeriod: '',
      perSeriesAligner: '',
      groupBys: [],
    },
    filters: existingFilters || [],
    aliasBy: '',
    metricService: '',
    metricKind: '',
    valueType: '',
  };
}
