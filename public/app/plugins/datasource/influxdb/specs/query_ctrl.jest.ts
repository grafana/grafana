import '../query_ctrl';
import 'app/core/services/segment_srv';
import { uiSegmentSrv } from 'app/core/services/segment_srv';
//import { describe, beforeEach, it, sinon, expect, angularMocks } from 'test/lib/common';
//import helpers from 'test/specs/helpers';
import { InfluxQueryCtrl } from '../query_ctrl';

describe('InfluxDBQueryCtrl', () => {
  //var ctx = new helpers.ControllerTestContext();

  // beforeEach(angularMocks.module('grafana.core'));
  // beforeEach(angularMocks.module('grafana.controllers'));
  // beforeEach(angularMocks.module('grafana.services'));
  // beforeEach(
  //   angularMocks.module(($ =>compileProvider) {
  //     $compileProvider.preAssignBindingsEnabled(true);
  //   })
  // );
  // beforeEach(ctx.providePhase());

  // beforeEach(
  //   angularMocks.inject(($rootScope, $controller, $q) => {
  //     ctx.$q = $q;
  //     ctx.scope = $rootScope.$new();
  //     ctx.datasource.metricFindQuery = sinon.stub().returns(ctx.$q.when([]));
  //     ctx.target = { target: {} };
  //     ctx.panelCtrl = {
  //       panel: {
  //         targets: [ctx.target],
  //       },
  //     };
  //     ctx.panelCtrl.refresh = sinon.spy();
  //     influxQueryCtrl = $controller(
  //       InfluxQueryCtrl,
  //       { $scope: ctx.scope },
  //       {
  //         panelCtrl: ctx.panelCtrl,
  //         target: ctx.target,
  //         datasource: ctx.datasource,
  //       }
  //     );
  //   })
  // );

  InfluxQueryCtrl.prototype.target = { target: {} };
  InfluxQueryCtrl.prototype.panelCtrl = {
    refresh: jest.fn(),
    panel: {
      targets: [InfluxQueryCtrl.prototype.target],
    },
  };
  InfluxQueryCtrl.prototype.datasource = {
    metricFindQuery: jest.fn(() => Promise.resolve([])),
  };

  // let uiSegmentSrv = {
  //   newPlusButton: jest.fn(),
  //   newSegment: jest.fn(),
  //   newSelectMeasurement: jest.fn()
  // };
  let influxQueryCtrl;

  beforeEach(() => {
    influxQueryCtrl = new InfluxQueryCtrl(
      {},
      {},
      {},
      {},
      new uiSegmentSrv({ trustAsHtml: jest.fn() }, { highlightVariablesAsHtml: jest.fn() })
    );
  });

  describe('init', () => {
    it('should init tagSegments', () => {
      expect(influxQueryCtrl.tagSegments.length).toBe(1);
    });

    it('should init measurementSegment', () => {
      expect(influxQueryCtrl.measurementSegment.value).toBe('select measurement');
    });
  });

  describe('when first tag segment is updated', () => {
    beforeEach(() => {
      influxQueryCtrl.tagSegmentUpdated({ value: 'asd', type: 'plus-button' }, 0);
    });

    it('should update tag key', () => {
      expect(influxQueryCtrl.target.tags[0].key).toBe('asd');
      expect(influxQueryCtrl.tagSegments[0].type).toBe('key');
    });

    it('should add tagSegments', () => {
      expect(influxQueryCtrl.tagSegments.length).toBe(3);
    });
  });

  describe('when last tag value segment is updated', () => {
    beforeEach(() => {
      influxQueryCtrl.tagSegmentUpdated({ value: 'asd', type: 'plus-button' }, 0);
      influxQueryCtrl.tagSegmentUpdated({ value: 'server1', type: 'value' }, 2);
    });

    it('should update tag value', () => {
      expect(influxQueryCtrl.target.tags[0].value).toBe('server1');
    });

    it('should set tag operator', () => {
      expect(influxQueryCtrl.target.tags[0].operator).toBe('=');
    });

    it('should add plus button for another filter', () => {
      expect(influxQueryCtrl.tagSegments[3].fake).toBe(true);
    });
  });

  describe('when last tag value segment is updated to regex', () => {
    beforeEach(() => {
      influxQueryCtrl.tagSegmentUpdated({ value: 'asd', type: 'plus-button' }, 0);
      influxQueryCtrl.tagSegmentUpdated({ value: '/server.*/', type: 'value' }, 2);
    });

    it('should update operator', () => {
      expect(influxQueryCtrl.tagSegments[1].value).toBe('=~');
      expect(influxQueryCtrl.target.tags[0].operator).toBe('=~');
    });
  });

  describe('when second tag key is added', () => {
    beforeEach(() => {
      influxQueryCtrl.tagSegmentUpdated({ value: 'asd', type: 'plus-button' }, 0);
      influxQueryCtrl.tagSegmentUpdated({ value: 'server1', type: 'value' }, 2);
      influxQueryCtrl.tagSegmentUpdated({ value: 'key2', type: 'plus-button' }, 3);
    });

    it('should update tag key', () => {
      expect(influxQueryCtrl.target.tags[1].key).toBe('key2');
    });

    it('should add AND segment', () => {
      expect(influxQueryCtrl.tagSegments[3].value).toBe('AND');
    });
  });

  describe('when condition is changed', () => {
    beforeEach(() => {
      influxQueryCtrl.tagSegmentUpdated({ value: 'asd', type: 'plus-button' }, 0);
      influxQueryCtrl.tagSegmentUpdated({ value: 'server1', type: 'value' }, 2);
      influxQueryCtrl.tagSegmentUpdated({ value: 'key2', type: 'plus-button' }, 3);
      influxQueryCtrl.tagSegmentUpdated({ value: 'OR', type: 'condition' }, 3);
    });

    it('should update tag condition', () => {
      expect(influxQueryCtrl.target.tags[1].condition).toBe('OR');
    });

    it('should update AND segment', () => {
      expect(influxQueryCtrl.tagSegments[3].value).toBe('OR');
      expect(influxQueryCtrl.tagSegments.length).toBe(7);
    });
  });

  describe('when deleting first tag filter after value is selected', () => {
    beforeEach(() => {
      influxQueryCtrl.tagSegmentUpdated({ value: 'asd', type: 'plus-button' }, 0);
      influxQueryCtrl.tagSegmentUpdated({ value: 'server1', type: 'value' }, 2);
      influxQueryCtrl.tagSegmentUpdated(influxQueryCtrl.removeTagFilterSegment, 0);
    });

    it('should remove tags', () => {
      expect(influxQueryCtrl.target.tags.length).toBe(0);
    });

    it('should remove all segment after 2 and replace with plus button', () => {
      expect(influxQueryCtrl.tagSegments.length).toBe(1);
      expect(influxQueryCtrl.tagSegments[0].type).toBe('plus-button');
    });
  });

  describe('when deleting second tag value before second tag value is complete', () => {
    beforeEach(() => {
      influxQueryCtrl.tagSegmentUpdated({ value: 'asd', type: 'plus-button' }, 0);
      influxQueryCtrl.tagSegmentUpdated({ value: 'server1', type: 'value' }, 2);
      influxQueryCtrl.tagSegmentUpdated({ value: 'key2', type: 'plus-button' }, 3);
      influxQueryCtrl.tagSegmentUpdated(influxQueryCtrl.removeTagFilterSegment, 4);
    });

    it('should remove all segment after 2 and replace with plus button', () => {
      expect(influxQueryCtrl.tagSegments.length).toBe(4);
      expect(influxQueryCtrl.tagSegments[3].type).toBe('plus-button');
    });
  });

  describe('when deleting second tag value before second tag value is complete', () => {
    beforeEach(() => {
      influxQueryCtrl.tagSegmentUpdated({ value: 'asd', type: 'plus-button' }, 0);
      influxQueryCtrl.tagSegmentUpdated({ value: 'server1', type: 'value' }, 2);
      influxQueryCtrl.tagSegmentUpdated({ value: 'key2', type: 'plus-button' }, 3);
      influxQueryCtrl.tagSegmentUpdated(influxQueryCtrl.removeTagFilterSegment, 4);
    });

    it('should remove all segment after 2 and replace with plus button', () => {
      expect(influxQueryCtrl.tagSegments.length).toBe(4);
      expect(influxQueryCtrl.tagSegments[3].type).toBe('plus-button');
    });
  });

  describe('when deleting second tag value after second tag filter is complete', () => {
    beforeEach(() => {
      influxQueryCtrl.tagSegmentUpdated({ value: 'asd', type: 'plus-button' }, 0);
      influxQueryCtrl.tagSegmentUpdated({ value: 'server1', type: 'value' }, 2);
      influxQueryCtrl.tagSegmentUpdated({ value: 'key2', type: 'plus-button' }, 3);
      influxQueryCtrl.tagSegmentUpdated({ value: 'value', type: 'value' }, 6);
      influxQueryCtrl.tagSegmentUpdated(influxQueryCtrl.removeTagFilterSegment, 4);
    });

    it('should remove all segment after 2 and replace with plus button', () => {
      expect(influxQueryCtrl.tagSegments.length).toBe(4);
      expect(influxQueryCtrl.tagSegments[3].type).toBe('plus-button');
    });
  });
});
