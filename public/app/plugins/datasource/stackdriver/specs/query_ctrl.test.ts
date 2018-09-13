import { StackdriverQueryCtrl } from '../query_ctrl';

describe('StackdriverQueryCtrl', () => {
  let ctrl;
  let result;

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

function createCtrlWithFakes() {
  StackdriverQueryCtrl.prototype.panelCtrl = {
    events: { on: () => {} },
    panel: { scopedVars: [], targets: [] },
    refresh: () => {},
  };
  StackdriverQueryCtrl.prototype.target = createTarget();
  StackdriverQueryCtrl.prototype.getMetricTypes = () => {
    return Promise.resolve();
  };
  StackdriverQueryCtrl.prototype.getLabels = () => {
    return Promise.resolve();
  };

  const fakeSegmentServer = {
    newSegment: obj => {
      return { value: obj.value };
    },
    newPlusButton: () => {},
  };
  return new StackdriverQueryCtrl(null, null, fakeSegmentServer, null);
}

function createTarget() {
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
  };
}
