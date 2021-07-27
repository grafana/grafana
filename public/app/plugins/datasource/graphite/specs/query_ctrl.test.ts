import { dispatch } from 'app/store/store';
import { uiSegmentSrv } from 'app/core/services/segment_srv';
import gfunc from '../gfunc';
import { GraphiteQueryCtrl } from '../query_ctrl';
import { TemplateSrvStub } from 'test/specs/helpers';
import { silenceConsoleOutput } from 'test/core/utils/silenceConsoleOutput';
import { actions } from '../state/actions';

jest.mock('app/core/utils/promiseToDigest', () => ({
  promiseToDigest: (scope: any) => {
    return (p: Promise<any>) => p;
  },
}));

jest.mock('app/store/store', () => ({
  dispatch: jest.fn(),
}));
const mockDispatch = dispatch as jest.Mock;

/**
 * Simulate switching to text editor, changing the query and switching back to visual editor
 */
async function changeTarget(ctx: any, target: string): Promise<void> {
  await ctx.ctrl.toggleEditorMode();
  await ctx.ctrl.dispatch(actions.updateQuery({ query: target }));
  await ctx.ctrl.dispatch(actions.runQuery());
  await ctx.ctrl.toggleEditorMode();
}

describe('GraphiteQueryCtrl', () => {
  const ctx = {
    datasource: {
      metricFindQuery: jest.fn(() => Promise.resolve([])),
      getFuncDefs: jest.fn(() => Promise.resolve(gfunc.getFuncDefs('1.0'))),
      getFuncDef: gfunc.getFuncDef,
      waitForFuncDefsLoaded: jest.fn(() => Promise.resolve(null)),
      createFuncInstance: gfunc.createFuncInstance,
      getTagsAutoComplete: jest.fn().mockReturnValue(Promise.resolve([])),
    },
    target: { target: 'aliasByNode(scaleToSeconds(test.prod.*,1),2)' },
    panelCtrl: {
      refresh: jest.fn(),
    },
  } as any;

  ctx.panelCtrl.panel = {
    targets: [ctx.target],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    GraphiteQueryCtrl.prototype.target = ctx.target;
    GraphiteQueryCtrl.prototype.datasource = ctx.datasource;
    GraphiteQueryCtrl.prototype.panelCtrl = ctx.panelCtrl;

    ctx.ctrl = new GraphiteQueryCtrl(
      { $digest: jest.fn() },
      {} as any,
      //@ts-ignore
      new uiSegmentSrv({ trustAsHtml: (html) => html }, { highlightVariablesAsHtml: () => {} }),
      //@ts-ignore
      new TemplateSrvStub()
    );

    // resolve async code called by the constructor
    await Promise.resolve();
  });

  describe('init', () => {
    it('should validate metric key exists', () => {
      expect(ctx.datasource.metricFindQuery.mock.calls[0][0]).toBe('test.prod.*');
    });

    it('should not delete last segment if no metrics are found', () => {
      expect(ctx.ctrl.state.segments[2].value).not.toBe('select metric');
      expect(ctx.ctrl.state.segments[2].value).toBe('*');
    });

    it('should parse expression and build function model', () => {
      expect(ctx.ctrl.state.queryModel.functions.length).toBe(2);
    });
  });

  describe('when toggling edit mode to raw and back again', () => {
    beforeEach(async () => {
      await ctx.ctrl.toggleEditorMode();
      await ctx.ctrl.toggleEditorMode();
    });

    it('should validate metric key exists', () => {
      const lastCallIndex = ctx.datasource.metricFindQuery.mock.calls.length - 1;
      expect(ctx.datasource.metricFindQuery.mock.calls[lastCallIndex][0]).toBe('test.prod.*');
    });

    it('should delete last segment if no metrics are found', () => {
      expect(ctx.ctrl.state.segments[0].value).toBe('test');
      expect(ctx.ctrl.state.segments[1].value).toBe('prod');
      expect(ctx.ctrl.state.segments[2].value).toBe('select metric');
    });

    it('should parse expression and build function model', () => {
      expect(ctx.ctrl.state.queryModel.functions.length).toBe(2);
    });
  });

  describe('when middle segment value of test.prod.* is changed', () => {
    beforeEach(async () => {
      const segment = { type: 'segment', value: 'test', expandable: true };
      await ctx.ctrl.segmentValueChanged(segment, 1);
    });

    it('should validate metric key exists', () => {
      const lastCallIndex = ctx.datasource.metricFindQuery.mock.calls.length - 1;
      expect(ctx.datasource.metricFindQuery.mock.calls[lastCallIndex][0]).toBe('test.test.*');
    });

    it('should delete last segment if no metrics are found', () => {
      expect(ctx.ctrl.state.segments[0].value).toBe('test');
      expect(ctx.ctrl.state.segments[1].value).toBe('test');
      expect(ctx.ctrl.state.segments[2].value).toBe('select metric');
    });

    it('should parse expression and build function model', () => {
      expect(ctx.ctrl.state.queryModel.functions.length).toBe(2);
    });
  });

  describe('when adding function', () => {
    beforeEach(async () => {
      ctx.ctrl.state.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
      await changeTarget(ctx, 'test.prod.*.count');
      await ctx.ctrl.addFunction(gfunc.getFuncDef('aliasByNode'));
    });

    it('should add function with correct node number', () => {
      expect(ctx.ctrl.state.queryModel.functions[0].params[0]).toBe(2);
    });

    it('should update target', () => {
      expect(ctx.ctrl.state.target.target).toBe('aliasByNode(test.prod.*.count, 2)');
    });

    it('should call refresh', () => {
      expect(ctx.panelCtrl.refresh).toHaveBeenCalled();
    });
  });

  describe('when adding function before any metric segment', () => {
    beforeEach(async () => {
      ctx.ctrl.state.datasource.metricFindQuery = () => Promise.resolve([{ expandable: true }]);
      await changeTarget(ctx, '');
      await ctx.ctrl.addFunction(gfunc.getFuncDef('asPercent'));
    });

    it('should add function and remove select metric link', () => {
      expect(ctx.ctrl.state.segments.length).toBe(0);
    });
  });

  describe('when initializing a target with single param func using variable', () => {
    beforeEach(async () => {
      ctx.ctrl.state.datasource.metricFindQuery = () => Promise.resolve([]);
      await changeTarget(ctx, 'movingAverage(prod.count, $var)');
    });

    it('should add 2 segments', () => {
      expect(ctx.ctrl.state.segments.length).toBe(2);
    });

    it('should add function param', () => {
      expect(ctx.ctrl.state.queryModel.functions[0].params.length).toBe(1);
    });
  });

  describe('when initializing target without metric expression and function with series-ref', () => {
    beforeEach(async () => {
      ctx.ctrl.state.datasource.metricFindQuery = () => Promise.resolve([]);
      await changeTarget(ctx, 'asPercent(metric.node.count, #A)');
    });

    it('should add segments', () => {
      expect(ctx.ctrl.state.segments.length).toBe(3);
    });

    it('should have correct func params', () => {
      expect(ctx.ctrl.state.queryModel.functions[0].params.length).toBe(1);
    });
  });

  describe('when getting altSegments and metricFindQuery returns empty array', () => {
    beforeEach(async () => {
      ctx.ctrl.state.datasource.metricFindQuery = () => Promise.resolve([]);
      await changeTarget(ctx, 'test.count');
      ctx.altSegments = await ctx.ctrl.getAltSegments(1, '');
    });

    it('should have no segments', () => {
      expect(ctx.altSegments.length).toBe(0);
    });
  });

  describe('when autocomplete for metric names is not available', () => {
    silenceConsoleOutput();
    beforeEach(() => {
      ctx.ctrl.state.datasource.getTagsAutoComplete = jest.fn().mockReturnValue(Promise.resolve([]));
      ctx.ctrl.state.datasource.metricFindQuery = jest.fn().mockReturnValue(
        new Promise(() => {
          throw new Error();
        })
      );
    });

    it('getAltSegments should handle autocomplete errors', async () => {
      await expect(async () => {
        await ctx.ctrl.getAltSegments(0, 'any');
        expect(mockDispatch).toBeCalledWith(
          expect.objectContaining({
            type: 'appNotifications/notifyApp',
          })
        );
      }).not.toThrow();
    });

    it('getAltSegments should display the error message only once', async () => {
      await ctx.ctrl.getAltSegments(0, 'any');
      expect(mockDispatch.mock.calls.length).toBe(1);

      await ctx.ctrl.getAltSegments(0, 'any');
      expect(mockDispatch.mock.calls.length).toBe(1);
    });
  });

  describe('when autocomplete for tags is not available', () => {
    silenceConsoleOutput();
    beforeEach(() => {
      ctx.datasource.metricFindQuery = jest.fn().mockReturnValue(Promise.resolve([]));
      ctx.datasource.getTagsAutoComplete = jest.fn().mockReturnValue(
        new Promise(() => {
          throw new Error();
        })
      );
    });

    it('getTags should handle autocomplete errors', async () => {
      await expect(async () => {
        await ctx.ctrl.getTags(0, 'any');
        expect(mockDispatch).toBeCalledWith(
          expect.objectContaining({
            type: 'appNotifications/notifyApp',
          })
        );
      }).not.toThrow();
    });

    it('getTags should display the error message only once', async () => {
      await ctx.ctrl.getTags(0, 'any');
      expect(mockDispatch.mock.calls.length).toBe(1);

      await ctx.ctrl.getTags(0, 'any');
      expect(mockDispatch.mock.calls.length).toBe(1);
    });

    it('getTagsAsSegments should handle autocomplete errors', async () => {
      await expect(async () => {
        await ctx.ctrl.getTagsAsSegments('any');
        expect(mockDispatch).toBeCalledWith(
          expect.objectContaining({
            type: 'appNotifications/notifyApp',
          })
        );
      }).not.toThrow();
    });

    it('getTagsAsSegments should display the error message only once', async () => {
      await ctx.ctrl.getTagsAsSegments('any');
      expect(mockDispatch.mock.calls.length).toBe(1);

      await ctx.ctrl.getTagsAsSegments('any');
      expect(mockDispatch.mock.calls.length).toBe(1);
    });
  });

  describe('targetChanged', () => {
    beforeEach(async () => {
      const newQuery = 'aliasByNode(scaleToSeconds(test.prod.*, 1), 2)';
      ctx.ctrl.state.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
      await changeTarget(ctx, newQuery);
    });

    it('should rebuild target after expression model', () => {
      expect(ctx.ctrl.state.target.target).toBe('aliasByNode(scaleToSeconds(test.prod.*, 1), 2)');
    });

    it('should call panelCtrl.refresh', () => {
      expect(ctx.panelCtrl.refresh).toHaveBeenCalled();
    });
  });

  describe('when updating targets with nested query', () => {
    beforeEach(async () => {
      ctx.ctrl.state.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
      await changeTarget(ctx, 'scaleToSeconds(#A, 60)');
    });

    it('should add function params', () => {
      expect(ctx.ctrl.state.queryModel.segments.length).toBe(1);
      expect(ctx.ctrl.state.queryModel.segments[0].value).toBe('#A');

      expect(ctx.ctrl.state.queryModel.functions[0].params.length).toBe(1);
      expect(ctx.ctrl.state.queryModel.functions[0].params[0]).toBe(60);
    });

    it('target should remain the same', () => {
      expect(ctx.ctrl.state.target.target).toBe('scaleToSeconds(#A, 60)');
    });

    it('targetFull should include nested queries', async () => {
      ctx.ctrl.state.panelCtrl.panel.targets = [
        {
          target: 'nested.query.count',
          refId: 'A',
        },
      ];

      await changeTarget(ctx, ctx.target.target);

      expect(ctx.ctrl.state.target.target).toBe('scaleToSeconds(#A, 60)');

      expect(ctx.ctrl.state.target.targetFull).toBe('scaleToSeconds(nested.query.count, 60)');
    });
  });

  describe('when updating target used in other query', () => {
    beforeEach(async () => {
      ctx.ctrl.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
      ctx.ctrl.target.refId = 'A';
      await changeTarget(ctx, 'metrics.foo.count');

      ctx.ctrl.state.panelCtrl.panel.targets = [ctx.ctrl.target, { target: 'sumSeries(#A)', refId: 'B' }];

      await changeTarget(ctx, 'metrics.bar.count');
    });

    it('targetFull of other query should update', () => {
      expect(ctx.ctrl.state.panelCtrl.panel.targets[1].targetFull).toBe('sumSeries(metrics.bar.count)');
    });
  });

  describe('when adding seriesByTag function', () => {
    beforeEach(async () => {
      ctx.ctrl.state.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
      await changeTarget(ctx, '');
      await ctx.ctrl.addFunction(gfunc.getFuncDef('seriesByTag'));
    });

    it('should update functions', () => {
      expect(ctx.ctrl.state.queryModel.getSeriesByTagFuncIndex()).toBe(0);
    });

    it('should update seriesByTagUsed flag', () => {
      expect(ctx.ctrl.state.queryModel.seriesByTagUsed).toBe(true);
    });

    it('should update target', () => {
      expect(ctx.ctrl.state.target.target).toBe('seriesByTag()');
    });

    it('should call refresh', () => {
      expect(ctx.panelCtrl.refresh).toHaveBeenCalled();
    });
  });

  describe('when parsing seriesByTag function', () => {
    beforeEach(async () => {
      ctx.ctrl.state.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
      await changeTarget(ctx, "seriesByTag('tag1=value1', 'tag2!=~value2')");
    });

    it('should add tags', () => {
      const expected = [
        { key: 'tag1', operator: '=', value: 'value1' },
        { key: 'tag2', operator: '!=~', value: 'value2' },
      ];
      expect(ctx.ctrl.state.queryModel.tags).toEqual(expected);
    });

    it('should add plus button', () => {
      expect(ctx.ctrl.state.addTagSegments.length).toBe(1);
    });
  });

  describe('when tag added', () => {
    beforeEach(async () => {
      ctx.ctrl.state.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
      await changeTarget(ctx, 'seriesByTag()');
      await ctx.ctrl.addNewTag({ value: 'tag1' });
    });

    it('should update tags with default value', () => {
      const expected = [{ key: 'tag1', operator: '=', value: '' }];
      expect(ctx.ctrl.state.queryModel.tags).toEqual(expected);
    });

    it('should update target', () => {
      const expected = "seriesByTag('tag1=')";
      expect(ctx.ctrl.state.target.target).toEqual(expected);
    });
  });

  describe('when tag changed', () => {
    beforeEach(async () => {
      ctx.ctrl.state.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
      await changeTarget(ctx, "seriesByTag('tag1=value1', 'tag2!=~value2')");
      await ctx.ctrl.tagChanged({ key: 'tag1', operator: '=', value: 'new_value' }, 0);
    });

    it('should update tags', () => {
      const expected = [
        { key: 'tag1', operator: '=', value: 'new_value' },
        { key: 'tag2', operator: '!=~', value: 'value2' },
      ];
      expect(ctx.ctrl.state.queryModel.tags).toEqual(expected);
    });

    it('should update target', () => {
      const expected = "seriesByTag('tag1=new_value', 'tag2!=~value2')";
      expect(ctx.ctrl.state.target.target).toEqual(expected);
    });
  });

  describe('when tag removed', () => {
    beforeEach(async () => {
      ctx.ctrl.state.datasource.metricFindQuery = () => Promise.resolve([{ expandable: false }]);
      await changeTarget(ctx, "seriesByTag('tag1=value1', 'tag2!=~value2')");
      await ctx.ctrl.tagChanged({ key: ctx.ctrl.state.removeTagValue });
    });

    it('should update tags', () => {
      const expected = [{ key: 'tag2', operator: '!=~', value: 'value2' }];
      expect(ctx.ctrl.state.queryModel.tags).toEqual(expected);
    });

    it('should update target', () => {
      const expected = "seriesByTag('tag2!=~value2')";
      expect(ctx.ctrl.state.target.target).toEqual(expected);
    });
  });
});
