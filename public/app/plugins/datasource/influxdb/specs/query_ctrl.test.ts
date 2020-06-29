import '../query_ctrl';
import { uiSegmentSrv } from 'app/core/services/segment_srv';
import { InfluxQueryCtrl } from '../query_ctrl';
import InfluxDatasource from '../datasource';

describe('InfluxDBQueryCtrl', () => {
  const ctx = {} as any;

  beforeEach(() => {
    InfluxQueryCtrl.prototype.datasource = ({
      metricFindQuery: () => Promise.resolve([]),
    } as unknown) as InfluxDatasource;
    InfluxQueryCtrl.prototype.target = { target: {} };
    InfluxQueryCtrl.prototype.panelCtrl = {
      panel: {
        targets: [InfluxQueryCtrl.prototype.target],
      },
      refresh: () => {},
    };

    ctx.ctrl = new InfluxQueryCtrl(
      {},
      {} as any,
      {} as any,
      //@ts-ignore
      new uiSegmentSrv({ trustAsHtml: (html: any) => html }, { highlightVariablesAsHtml: () => {} })
    );
  });

  describe('init', () => {
    it('should init tagSegments', () => {
      expect(ctx.ctrl.tagSegments.length).toBe(1);
    });

    it('should init measurementSegment', () => {
      expect(ctx.ctrl.measurementSegment.value).toBe('select measurement');
    });
  });

  describe('when first tag segment is updated', () => {
    beforeEach(() => {
      ctx.ctrl.tagSegmentUpdated({ value: 'asd', type: 'plus-button' }, 0);
    });

    it('should update tag key', () => {
      expect(ctx.ctrl.target.tags[0].key).toBe('asd');
      expect(ctx.ctrl.tagSegments[0].type).toBe('key');
    });

    it('should add tagSegments', () => {
      expect(ctx.ctrl.tagSegments.length).toBe(3);
    });
  });

  describe('when last tag value segment is updated', () => {
    beforeEach(() => {
      ctx.ctrl.tagSegmentUpdated({ value: 'asd', type: 'plus-button' }, 0);
      ctx.ctrl.tagSegmentUpdated({ value: 'server1', type: 'value' }, 2);
    });

    it('should update tag value', () => {
      expect(ctx.ctrl.target.tags[0].value).toBe('server1');
    });

    it('should set tag operator', () => {
      expect(ctx.ctrl.target.tags[0].operator).toBe('=');
    });

    it('should add plus button for another filter', () => {
      expect(ctx.ctrl.tagSegments[3].fake).toBe(true);
    });
  });

  describe('when last tag value segment is updated to regex', () => {
    beforeEach(() => {
      ctx.ctrl.tagSegmentUpdated({ value: 'asd', type: 'plus-button' }, 0);
      ctx.ctrl.tagSegmentUpdated({ value: '/server.*/', type: 'value' }, 2);
    });

    it('should update operator', () => {
      expect(ctx.ctrl.tagSegments[1].value).toBe('=~');
      expect(ctx.ctrl.target.tags[0].operator).toBe('=~');
    });
  });

  describe('when second tag key is added', () => {
    beforeEach(() => {
      ctx.ctrl.tagSegmentUpdated({ value: 'asd', type: 'plus-button' }, 0);
      ctx.ctrl.tagSegmentUpdated({ value: 'server1', type: 'value' }, 2);
      ctx.ctrl.tagSegmentUpdated({ value: 'key2', type: 'plus-button' }, 3);
    });

    it('should update tag key', () => {
      expect(ctx.ctrl.target.tags[1].key).toBe('key2');
    });

    it('should add AND segment', () => {
      expect(ctx.ctrl.tagSegments[3].value).toBe('AND');
    });
  });

  describe('when condition is changed', () => {
    beforeEach(() => {
      ctx.ctrl.tagSegmentUpdated({ value: 'asd', type: 'plus-button' }, 0);
      ctx.ctrl.tagSegmentUpdated({ value: 'server1', type: 'value' }, 2);
      ctx.ctrl.tagSegmentUpdated({ value: 'key2', type: 'plus-button' }, 3);
      ctx.ctrl.tagSegmentUpdated({ value: 'OR', type: 'condition' }, 3);
    });

    it('should update tag condition', () => {
      expect(ctx.ctrl.target.tags[1].condition).toBe('OR');
    });

    it('should update AND segment', () => {
      expect(ctx.ctrl.tagSegments[3].value).toBe('OR');
      expect(ctx.ctrl.tagSegments.length).toBe(7);
    });
  });

  describe('when deleting first tag filter after value is selected', () => {
    beforeEach(() => {
      ctx.ctrl.tagSegmentUpdated({ value: 'asd', type: 'plus-button' }, 0);
      ctx.ctrl.tagSegmentUpdated({ value: 'server1', type: 'value' }, 2);
      ctx.ctrl.tagSegmentUpdated(ctx.ctrl.removeTagFilterSegment, 0);
    });

    it('should remove tags', () => {
      expect(ctx.ctrl.target.tags.length).toBe(0);
    });

    it('should remove all segment after 2 and replace with plus button', () => {
      expect(ctx.ctrl.tagSegments.length).toBe(1);
      expect(ctx.ctrl.tagSegments[0].type).toBe('plus-button');
    });
  });

  describe('when deleting second tag value before second tag value is complete', () => {
    beforeEach(() => {
      ctx.ctrl.tagSegmentUpdated({ value: 'asd', type: 'plus-button' }, 0);
      ctx.ctrl.tagSegmentUpdated({ value: 'server1', type: 'value' }, 2);
      ctx.ctrl.tagSegmentUpdated({ value: 'key2', type: 'plus-button' }, 3);
      ctx.ctrl.tagSegmentUpdated(ctx.ctrl.removeTagFilterSegment, 4);
    });

    it('should remove all segment after 2 and replace with plus button', () => {
      expect(ctx.ctrl.tagSegments.length).toBe(4);
      expect(ctx.ctrl.tagSegments[3].type).toBe('plus-button');
    });
  });

  describe('when deleting second tag value before second tag value is complete', () => {
    beforeEach(() => {
      ctx.ctrl.tagSegmentUpdated({ value: 'asd', type: 'plus-button' }, 0);
      ctx.ctrl.tagSegmentUpdated({ value: 'server1', type: 'value' }, 2);
      ctx.ctrl.tagSegmentUpdated({ value: 'key2', type: 'plus-button' }, 3);
      ctx.ctrl.tagSegmentUpdated(ctx.ctrl.removeTagFilterSegment, 4);
    });

    it('should remove all segment after 2 and replace with plus button', () => {
      expect(ctx.ctrl.tagSegments.length).toBe(4);
      expect(ctx.ctrl.tagSegments[3].type).toBe('plus-button');
    });
  });

  describe('when deleting second tag value after second tag filter is complete', () => {
    beforeEach(() => {
      ctx.ctrl.tagSegmentUpdated({ value: 'asd', type: 'plus-button' }, 0);
      ctx.ctrl.tagSegmentUpdated({ value: 'server1', type: 'value' }, 2);
      ctx.ctrl.tagSegmentUpdated({ value: 'key2', type: 'plus-button' }, 3);
      ctx.ctrl.tagSegmentUpdated({ value: 'value', type: 'value' }, 6);
      ctx.ctrl.tagSegmentUpdated(ctx.ctrl.removeTagFilterSegment, 4);
    });

    it('should remove all segment after 2 and replace with plus button', () => {
      expect(ctx.ctrl.tagSegments.length).toBe(4);
      expect(ctx.ctrl.tagSegments[3].type).toBe('plus-button');
    });
  });
});
