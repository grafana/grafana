import { uiSegmentSrv } from 'app/core/services/segment_srv';
import gfunc from '../gfunc';
import { GraphiteQueryCtrl } from '../query_ctrl';
import { TemplateSrvStub } from 'test/specs/helpers';

jest.mock('app/core/utils/promiseToDigest', () => ({
  promiseToDigest: (scope: any) => {
    return (p: Promise<any>) => p;
  },
}));

describe('GraphiteQueryCtrl', () => {
  const ctx = {
    datasource: {
      metricFindQuery: jest.fn(() => Promise.resolve([])),
      getFuncDefs: jest.fn(() => Promise.resolve(gfunc.getFuncDefs('1.0'))),
      getFuncDef: gfunc.getFuncDef,
      waitForFuncDefsLoaded: jest.fn(() => Promise.resolve(null)),
      createFuncInstance: gfunc.createFuncInstance,
    },
    target: { target: 'aliasByNode(scaleToSeconds(test.prod.*,1),2)' },
    panelCtrl: {
      refresh: jest.fn(),
    },
  } as any;

  ctx.panelCtrl.panel = {
    targets: [ctx.target],
  };

  beforeEach(() => {
    GraphiteQueryCtrl.prototype.target = ctx.target;
    GraphiteQueryCtrl.prototype.datasource = ctx.datasource;
    GraphiteQueryCtrl.prototype.panelCtrl = ctx.panelCtrl;

    ctx.ctrl = new GraphiteQueryCtrl(
      {},
      {} as any,
      //@ts-ignore
      new uiSegmentSrv({ trustAsHtml: html => html }, { highlightVariablesAsHtml: () => {} }),
      //@ts-ignore
      new TemplateSrvStub(),
      {}
    );
  });

  describe('init', () => {
    it('should validate metric key exists', () => {
      expect(ctx.datasource.metricFindQuery.mock.calls[0][0]).toBe('test.prod.*');
    });

    it('should not delete last segment if no metrics are found', () => {
      expect(ctx.ctrl.segments[2].value).not.toBe('select metric');
      expect(ctx.ctrl.segments[2].value).toBe('*');
    });

    it('should parse expression and build function model', () => {
      expect(ctx.ctrl.queryModel.functions.length).toBe(2);
    });
  });

  describe('when toggling edit mode to raw and back again', () => {
    beforeEach(() => {
      ctx.ctrl.toggleEditorMode();
      ctx.ctrl.toggleEditorMode();
    });

    it('should validate metric key exists', () => {
      const lastCallIndex = ctx.datasource.metricFindQuery.mock.calls.length - 1;
      expect(ctx.datasource.metricFindQuery.mock.calls[lastCallIndex][0]).toBe('test.prod.*');
    });

    it('should delete last segment if no metrics are found', () => {
      expect(ctx.ctrl.segments[0].value).toBe('test');
      expect(ctx.ctrl.segments[1].value).toBe('prod');
      expect(ctx.ctrl.segments[2].value).toBe('select metric');
    });

    it('should parse expression and build function model', () => {
      expect(ctx.ctrl.queryModel.functions.length).toBe(2);
    });
  });

  describe('when middle segment value of test.prod.* is changed', () => {
    beforeEach(() => {
      const segment = { type: 'segment', value: 'test', expandable: true };
      ctx.ctrl.segmentValueChanged(segment, 1);
    });

    it('should validate metric key exists', () => {
      const lastCallIndex = ctx.datasource.metricFindQuery.mock.calls.length - 1;
      expect(ctx.datasource.metricFindQuery.mock.calls[lastCallIndex][0]).toBe('test.test.*');
    });

    it('should delete last segment if no metrics are found', () => {
      expect(ctx.ctrl.segments[0].value).toBe('test');
      expect(ctx.ctrl.segments[1].value).toBe('test');
      expect(ctx.ctrl.segments[2].value).toBe('select metric');
    });

    it('should parse expression and build function model', () => {
      expect(ctx.ctrl.queryModel.functions.length).toBe(2);
    });
  });

  describe('when adding function', () => {
    beforeEach(() => {
      ctx.ctrl.target.target = 'test.prod.*.count';
      ctx.ctrl.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
      ctx.ctrl.parseTarget();
      ctx.ctrl.addFunction(gfunc.getFuncDef('aliasByNode'));
    });

    it('should add function with correct node number', () => {
      expect(ctx.ctrl.queryModel.functions[0].params[0]).toBe(2);
    });

    it('should update target', () => {
      expect(ctx.ctrl.target.target).toBe('aliasByNode(test.prod.*.count, 2)');
    });

    it('should call refresh', () => {
      expect(ctx.panelCtrl.refresh).toHaveBeenCalled();
    });
  });

  describe('when adding function before any metric segment', () => {
    beforeEach(() => {
      ctx.ctrl.target.target = '';
      ctx.ctrl.datasource.metricFindQuery = () => Promise.resolve([{ expandable: true }]);
      ctx.ctrl.parseTarget();
      ctx.ctrl.addFunction(gfunc.getFuncDef('asPercent'));
    });

    it('should add function and remove select metric link', () => {
      expect(ctx.ctrl.segments.length).toBe(0);
    });
  });

  describe('when initializing a target with single param func using variable', () => {
    beforeEach(() => {
      ctx.ctrl.target.target = 'movingAverage(prod.count, $var)';
      ctx.ctrl.datasource.metricFindQuery = () => Promise.resolve([]);
      ctx.ctrl.parseTarget();
    });

    it('should add 2 segments', () => {
      expect(ctx.ctrl.segments.length).toBe(2);
    });

    it('should add function param', () => {
      expect(ctx.ctrl.queryModel.functions[0].params.length).toBe(1);
    });
  });

  describe('when initializing target without metric expression and function with series-ref', () => {
    beforeEach(() => {
      ctx.ctrl.target.target = 'asPercent(metric.node.count, #A)';
      ctx.ctrl.datasource.metricFindQuery = () => Promise.resolve([]);
      ctx.ctrl.parseTarget();
    });

    it('should add segments', () => {
      expect(ctx.ctrl.segments.length).toBe(3);
    });

    it('should have correct func params', () => {
      expect(ctx.ctrl.queryModel.functions[0].params.length).toBe(1);
    });
  });

  describe('when getting altSegments and metricFindQuery returns empty array', () => {
    beforeEach(() => {
      ctx.ctrl.target.target = 'test.count';
      ctx.ctrl.datasource.metricFindQuery = () => Promise.resolve([]);
      ctx.ctrl.parseTarget();
      ctx.ctrl.getAltSegments(1).then((results: any) => {
        ctx.altSegments = results;
      });
    });

    it('should have no segments', () => {
      expect(ctx.altSegments.length).toBe(0);
    });
  });

  describe('targetChanged', () => {
    beforeEach(() => {
      ctx.ctrl.target.target = 'aliasByNode(scaleToSeconds(test.prod.*, 1), 2)';
      ctx.ctrl.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
      ctx.ctrl.parseTarget();
      ctx.ctrl.target.target = '';
      ctx.ctrl.targetChanged();
    });

    it('should rebuild target after expression model', () => {
      expect(ctx.ctrl.target.target).toBe('aliasByNode(scaleToSeconds(test.prod.*, 1), 2)');
    });

    it('should call panelCtrl.refresh', () => {
      expect(ctx.panelCtrl.refresh).toHaveBeenCalled();
    });
  });

  describe('when updating targets with nested query', () => {
    beforeEach(() => {
      ctx.ctrl.target.target = 'scaleToSeconds(#A, 60)';
      ctx.ctrl.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
      ctx.ctrl.parseTarget();
    });

    it('should add function params', () => {
      expect(ctx.ctrl.queryModel.segments.length).toBe(1);
      expect(ctx.ctrl.queryModel.segments[0].value).toBe('#A');

      expect(ctx.ctrl.queryModel.functions[0].params.length).toBe(1);
      expect(ctx.ctrl.queryModel.functions[0].params[0]).toBe(60);
    });

    it('target should remain the same', () => {
      expect(ctx.ctrl.target.target).toBe('scaleToSeconds(#A, 60)');
    });

    it('targetFull should include nested queries', () => {
      ctx.ctrl.panelCtrl.panel.targets = [
        {
          target: 'nested.query.count',
          refId: 'A',
        },
      ];

      ctx.ctrl.updateModelTarget();

      expect(ctx.ctrl.target.target).toBe('scaleToSeconds(#A, 60)');

      expect(ctx.ctrl.target.targetFull).toBe('scaleToSeconds(nested.query.count, 60)');
    });
  });

  describe('when updating target used in other query', () => {
    beforeEach(() => {
      ctx.ctrl.target.target = 'metrics.a.count';
      ctx.ctrl.target.refId = 'A';
      ctx.ctrl.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
      ctx.ctrl.parseTarget();

      ctx.ctrl.panelCtrl.panel.targets = [ctx.ctrl.target, { target: 'sumSeries(#A)', refId: 'B' }];

      ctx.ctrl.updateModelTarget();
    });

    it('targetFull of other query should update', () => {
      expect(ctx.ctrl.panel.targets[1].targetFull).toBe('sumSeries(metrics.a.count)');
    });
  });

  describe('when adding seriesByTag function', () => {
    beforeEach(() => {
      ctx.ctrl.target.target = '';
      ctx.ctrl.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
      ctx.ctrl.parseTarget();
      ctx.ctrl.addFunction(gfunc.getFuncDef('seriesByTag'));
    });

    it('should update functions', () => {
      expect(ctx.ctrl.queryModel.getSeriesByTagFuncIndex()).toBe(0);
    });

    it('should update seriesByTagUsed flag', () => {
      expect(ctx.ctrl.queryModel.seriesByTagUsed).toBe(true);
    });

    it('should update target', () => {
      expect(ctx.ctrl.target.target).toBe('seriesByTag()');
    });

    it('should call refresh', () => {
      expect(ctx.panelCtrl.refresh).toHaveBeenCalled();
    });
  });

  describe('when parsing seriesByTag function', () => {
    beforeEach(() => {
      ctx.ctrl.target.target = "seriesByTag('tag1=value1', 'tag2!=~value2')";
      ctx.ctrl.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
      ctx.ctrl.parseTarget();
    });

    it('should add tags', () => {
      const expected = [
        { key: 'tag1', operator: '=', value: 'value1' },
        { key: 'tag2', operator: '!=~', value: 'value2' },
      ];
      expect(ctx.ctrl.queryModel.tags).toEqual(expected);
    });

    it('should add plus button', () => {
      expect(ctx.ctrl.addTagSegments.length).toBe(1);
    });
  });

  describe('when tag added', () => {
    beforeEach(() => {
      ctx.ctrl.target.target = 'seriesByTag()';
      ctx.ctrl.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
      ctx.ctrl.parseTarget();
      ctx.ctrl.addNewTag({ value: 'tag1' });
    });

    it('should update tags with default value', () => {
      const expected = [{ key: 'tag1', operator: '=', value: '' }];
      expect(ctx.ctrl.queryModel.tags).toEqual(expected);
    });

    it('should update target', () => {
      const expected = "seriesByTag('tag1=')";
      expect(ctx.ctrl.target.target).toEqual(expected);
    });
  });

  describe('when tag changed', () => {
    beforeEach(() => {
      ctx.ctrl.target.target = "seriesByTag('tag1=value1', 'tag2!=~value2')";
      ctx.ctrl.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
      ctx.ctrl.parseTarget();
      ctx.ctrl.tagChanged({ key: 'tag1', operator: '=', value: 'new_value' }, 0);
    });

    it('should update tags', () => {
      const expected = [
        { key: 'tag1', operator: '=', value: 'new_value' },
        { key: 'tag2', operator: '!=~', value: 'value2' },
      ];
      expect(ctx.ctrl.queryModel.tags).toEqual(expected);
    });

    it('should update target', () => {
      const expected = "seriesByTag('tag1=new_value', 'tag2!=~value2')";
      expect(ctx.ctrl.target.target).toEqual(expected);
    });
  });

  describe('when tag removed', () => {
    beforeEach(() => {
      ctx.ctrl.target.target = "seriesByTag('tag1=value1', 'tag2!=~value2')";
      ctx.ctrl.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
      ctx.ctrl.parseTarget();
      ctx.ctrl.tagChanged({ key: ctx.ctrl.removeTagValue });
    });

    it('should update tags', () => {
      const expected = [{ key: 'tag2', operator: '!=~', value: 'value2' }];
      expect(ctx.ctrl.queryModel.tags).toEqual(expected);
    });

    it('should update target', () => {
      const expected = "seriesByTag('tag2!=~value2')";
      expect(ctx.ctrl.target.target).toEqual(expected);
    });
  });
});
