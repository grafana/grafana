import { TemplateSrvStub } from 'test/specs/helpers';

import gfunc from '../gfunc';
import GraphiteQuery from '../graphite_query';

describe('Graphite query model', () => {
  const ctx: any = {
    datasource: {
      getFuncDef: gfunc.getFuncDef,
      getFuncDefs: jest.fn().mockReturnValue(Promise.resolve(gfunc.getFuncDefs('1.0'))),
      waitForFuncDefsLoaded: jest.fn().mockReturnValue(Promise.resolve(null)),
      createFuncInstance: gfunc.createFuncInstance,
    },
    // @ts-ignore
    templateSrv: new TemplateSrvStub(),
    targets: [],
  };

  beforeEach(() => {
    ctx.target = { refId: 'A', target: 'scaleToSeconds(#A, 60)' };
    ctx.queryModel = new GraphiteQuery(ctx.datasource, ctx.target, ctx.templateSrv);
  });

  describe('when updating targets with nested queries', () => {
    beforeEach(() => {
      ctx.target = { refId: 'D', target: 'asPercent(#A, #C)' };
      ctx.targets = [
        { refId: 'A', target: 'first.query.count' },
        { refId: 'B', target: 'second.query.count' },
        { refId: 'C', target: 'diffSeries(#A, #B)' },
        { refId: 'D', target: 'asPercent(#A, #C)' },
      ];
      ctx.queryModel = new GraphiteQuery(ctx.datasource, ctx.target, ctx.templateSrv);
    });

    it('targetFull should include nested queries', () => {
      ctx.queryModel.updateRenderedTarget(ctx.target, ctx.targets);
      const targetFullExpected = 'asPercent(first.query.count, diffSeries(first.query.count, second.query.count))';
      expect(ctx.queryModel.target.targetFull).toBe(targetFullExpected);
    });

    it('targetFull should include nested queries with repeated subqueries', () => {
      ctx.target = { refId: 'C', target: 'scale(asPercent(diffSeries(#B, #A), #B), 100)' };
      ctx.targets = [
        { refId: 'A', target: 'first.query.count' },
        { refId: 'B', target: 'second.query.count' },
        { refId: 'C', target: 'scale(asPercent(diffSeries(#B, #A), #B), 100)' },
      ];
      ctx.queryModel = new GraphiteQuery(ctx.datasource, ctx.target, ctx.templateSrv);
      ctx.queryModel.updateRenderedTarget(ctx.target, ctx.targets);
      const targetFullExpected =
        'scale(asPercent(diffSeries(second.query.count, first.query.count), second.query.count), 100)';
      expect(ctx.queryModel.target.targetFull).toBe(targetFullExpected);
    });

    it('should not hang on circular references', () => {
      ctx.target.target = 'asPercent(#A, #B)';
      ctx.targets = [
        { refId: 'A', target: 'asPercent(#B, #C)' },
        { refId: 'B', target: 'asPercent(#A, #C)' },
      ];
      ctx.queryModel.updateRenderedTarget(ctx.target, ctx.targets);
      // Just ensure updateRenderedTarget() is completed and doesn't hang
      expect(ctx.queryModel.target.targetFull).toBeDefined();
    });
  });

  describe('when query seriesByTag and series ref', () => {
    beforeEach(() => {
      ctx.target = { refId: 'A', target: `group(seriesByTag('namespace=asd'), #A)` };
      ctx.targets = [ctx.target];
      ctx.queryModel = new GraphiteQuery(ctx.datasource, ctx.target, ctx.templateSrv);
    });

    it('should keep group function series ref', () => {
      expect(ctx.queryModel.functions[1].params[0]).toBe('#A');
    });
  });

  describe('when query has seriesByTag and highestMax with variable param', () => {
    beforeEach(() => {
      ctx.target = { refId: 'A', target: `highestMax(seriesByTag('namespace=asd'), $limit)` };
      ctx.targets = [ctx.target];
      ctx.queryModel = new GraphiteQuery(ctx.datasource, ctx.target, ctx.templateSrv);
    });

    it('should add $limit to highestMax function param', () => {
      expect(ctx.queryModel.segments.length).toBe(0);
      expect(ctx.queryModel.functions[1].params[0]).toBe('$limit');
    });
  });

  describe('when query is generated from segments', () => {
    beforeEach(() => {
      ctx.target = { refId: 'A', target: '' };
      ctx.queryModel = new GraphiteQuery(ctx.datasource, ctx.target, ctx.templateSrv);
    });

    it('and no segments are selected then the query is empty', () => {
      ctx.queryModel.segments = [{ value: 'select metric' }];
      ctx.queryModel.updateModelTarget(ctx.targets);

      expect(ctx.queryModel.target.target).toBe('');
    });

    it('and some segments are selected then segments without selected value are omitted', () => {
      ctx.queryModel.segments = [{ value: 'foo' }, { value: 'bar' }, { value: 'select metric' }];
      ctx.queryModel.updateModelTarget(ctx.targets);

      expect(ctx.queryModel.target.target).toBe('foo.bar');
    });
  });
});
