import { getTemplateSrv } from '@grafana/runtime';

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
    templateSrv: getTemplateSrv(),
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

    it('targetFull should include nested queries at any level with repeated subqueries', () => {
      ctx.target = { refId: 'C', target: 'aggregateSeriesLists(#B, #C, "sum")' };
      ctx.targets = [
        { refId: 'A', target: 'first.query.count' },
        { refId: 'B', target: "alias(timeShift(#A, '-1min', true), '-1min')" },
        { refId: 'C', target: "alias(timeShift(#A, '-2min', true), '-2min')" },
        { refId: 'D', target: 'aggregateSeriesLists(#B, #C, "sum")' },
      ];
      ctx.queryModel = new GraphiteQuery(ctx.datasource, ctx.target, ctx.templateSrv);
      ctx.queryModel.updateRenderedTarget(ctx.target, ctx.targets);
      const targetFullExpected =
        "aggregateSeriesLists(alias(timeShift(first.query.count, '-1min', true), '-1min'), alias(timeShift(first.query.count, '-2min', true), '-2min'), \"sum\")";
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

  describe('When the second parameter of a function is a function, the graphite parser breaks', () => {
    /* 
      all functions that take parameters as functions can have a bug where writing a query
      in code where the second parameter of the function IS A FUNCTION, 
      then switching from code to builder parsers the second function in a way that 
      changes the order of the params and wraps the first param in the second param.
      
      asPercent(seriesByTag('namespace=asd'), (seriesByTag('namespace=fgh')) 
      becomes
      asPercent(seriesByTag(seriesByTag('namespace=asd'), 'namespace=fgh'))

      This is due to the core functionality of parsing changed targets by reducing them, 
      where each function is wrapped in another function
      https://github.com/grafana/grafana/blob/main/public/app/plugins/datasource/graphite/graphite_query.ts#LL187C8-L187C8

      Parsing the second "function as param" as a string fixes this issue 

      This is one of the edge cases that could be a reason for either refactoring or rebuilding the Graphite query builder
    */
    describe('when query has multiple seriesByTags functions as parameters it updates the model target correctly', () => {
      beforeEach(() => {
        ctx.target = { refId: 'A', target: `asPercent(seriesByTag('namespace=asd'), seriesByTag('namespace=fgh'))` };
        ctx.targets = [ctx.target];
        ctx.queryModel = new GraphiteQuery(ctx.datasource, ctx.target, ctx.templateSrv);
      });

      it('should parse the second function param as a string and not a second function', () => {
        const targets = [
          {
            refId: 'A',
            datasource: {
              type: 'graphite',
              uid: 'zzz',
            },
            target: "asPercent(seriesByTag('namespace=jkl'), seriesByTag('namespace=fgh'))",
            textEditor: false,
            key: '123',
          },
        ];
        expect(ctx.queryModel.segments.length).toBe(0);
        expect(ctx.queryModel.functions.length).toBe(2);
        ctx.queryModel.updateModelTarget(targets);
        expect(ctx.queryModel.target.target).not.toContain('seriesByTag(seriesByTag(');
      });
    });

    describe('when query has divideSeriesLists function where second parameter is a function is parses correctly', () => {
      it('should parse the second function param as a string and not parse it as a second function', () => {
        const functionAsParam = 'scaleToSeconds(carbon.agents.0df7e0ba2701-a.cache.queries,1)';

        ctx.target = {
          refId: 'A',
          target: `divideSeriesLists(scaleToSeconds(nonNegativeDerivative(carbon.agents.0df7e0ba2701-a.cache.queries), 1), ${functionAsParam})`,
        };
        ctx.targets = [ctx.target];
        ctx.queryModel = new GraphiteQuery(ctx.datasource, ctx.target, ctx.templateSrv);

        const targets = [
          {
            refId: 'A',
            datasource: {
              type: 'graphite',
              uid: 'zzz',
            },
            target: `divideSeriesLists(scaleToSeconds(nonNegativeDerivative(carbon.agents.0df7e0ba2701-a.cache.queries), 1), ${functionAsParam})`,
            textEditor: false,
            key: '123',
          },
        ];
        expect(ctx.queryModel.segments.length).toBe(5);
        expect(ctx.queryModel.functions.length).toBe(3);
        ctx.queryModel.updateModelTarget(targets);
        expect(ctx.queryModel.target.target).toContain(functionAsParam);
      });

      it('should recursively parse a second function argument that contains another function as a string', () => {
        const nestedFunctionAsParam =
          'scaleToSeconds(nonNegativeDerivative(carbon.agents.0df7e0ba2701-a.cache.queries,1))';

        ctx.target = {
          refId: 'A',
          target: `divideSeriesLists(scaleToSeconds(nonNegativeDerivative(carbon.agents.0df7e0ba2701-a.cache.queries), 1), ${nestedFunctionAsParam})`,
        };
        ctx.targets = [ctx.target];
        ctx.queryModel = new GraphiteQuery(ctx.datasource, ctx.target, ctx.templateSrv);

        const targets = [
          {
            refId: 'A',
            datasource: {
              type: 'graphite',
              uid: 'zzz',
            },
            target: `divideSeriesLists(scaleToSeconds(nonNegativeDerivative(carbon.agents.0df7e0ba2701-a.cache.queries), 1), ${nestedFunctionAsParam})`,
            textEditor: false,
            key: '123',
          },
        ];
        expect(ctx.queryModel.segments.length).toBe(5);
        expect(ctx.queryModel.functions.length).toBe(3);
        ctx.queryModel.updateModelTarget(targets);
        expect(ctx.queryModel.target.target).toContain(nestedFunctionAsParam);
      });

      it('should recursively parse a second function argument where the first argument is a series', () => {
        const nestedFunctionAsParam =
          'scaleToSeconds(nonNegativeDerivative(carbon.agents.0df7e0ba2701-a.cache.queries,1))';

        ctx.target = {
          refId: 'A',
          target: `divideSeriesLists(carbon.agents.0df7e0ba2701-a.cache.queries, ${nestedFunctionAsParam})`,
        };
        ctx.targets = [ctx.target];
        ctx.queryModel = new GraphiteQuery(ctx.datasource, ctx.target, ctx.templateSrv);

        const targets = [
          {
            refId: 'A',
            datasource: {
              type: 'graphite',
              uid: 'zzz',
            },
            target: `divideSeriesLists(scaleToSeconds(nonNegativeDerivative(carbon.agents.0df7e0ba2701-a.cache.queries), 1), ${nestedFunctionAsParam})`,
            textEditor: false,
            key: '123',
          },
        ];
        expect(ctx.queryModel.segments.length).toBe(5);
        expect(ctx.queryModel.functions.length).toBe(1);
        ctx.queryModel.updateModelTarget(targets);
        expect(ctx.queryModel.target.target).toContain(nestedFunctionAsParam);
      });

      //This is not preferred behavior. The query builder cannot parse `maxSeries(sum(testSeries1), sum(testSeries2))` and when it can, remove this test
      it('should return an error when visual query builder query does not match raw query', () => {
        jest.spyOn(console, 'error').mockImplementation();
        ctx.target = {
          refId: 'A',
          target: 'maxSeries(sum(testSeries1), sum(testSeries2))',
        };
        ctx.targets = [ctx.target];
        ctx.queryModel = new GraphiteQuery(ctx.datasource, ctx.target, ctx.templateSrv);
        expect(ctx.queryModel.error).toBe(
          'Failed to make a visual query builder query that is equivalent to the query.\nOriginal query: maxSeries(sum(testSeries1), sum(testSeries2))\nQuery builder query: maxSeries(sumSeries(sumSeries(testSeries1), testSeries2))'
        );
      });
    });
  });
});
