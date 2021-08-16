import gfunc from '../gfunc';
import GraphiteQuery from '../graphite_query';
import { TemplateSrvStub } from 'test/specs/helpers';

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
});
