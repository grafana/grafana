import { uiSegmentSrv } from 'app/core/services/segment_srv';
import gfunc from '../gfunc';
import { GraphiteQueryCtrl } from '../query_ctrl';
describe('GraphiteQueryCtrl', function () {
    var ctx = {
        datasource: {
            metricFindQuery: jest.fn(function () { return Promise.resolve([]); }),
            getFuncDefs: jest.fn(function () { return Promise.resolve(gfunc.getFuncDefs('1.0')); }),
            getFuncDef: gfunc.getFuncDef,
            waitForFuncDefsLoaded: jest.fn(function () { return Promise.resolve(null); }),
            createFuncInstance: gfunc.createFuncInstance,
        },
        target: { target: 'aliasByNode(scaleToSeconds(test.prod.*,1),2)' },
        panelCtrl: {
            refresh: jest.fn(),
        },
    };
    ctx.panelCtrl.panel = {
        targets: [ctx.target],
    };
    beforeEach(function () {
        GraphiteQueryCtrl.prototype.target = ctx.target;
        GraphiteQueryCtrl.prototype.datasource = ctx.datasource;
        GraphiteQueryCtrl.prototype.panelCtrl = ctx.panelCtrl;
        ctx.ctrl = new GraphiteQueryCtrl({}, {}, new uiSegmentSrv({ trustAsHtml: function (html) { return html; } }, { highlightVariablesAsHtml: function () { } }), {}, {});
    });
    describe('init', function () {
        it('should validate metric key exists', function () {
            expect(ctx.datasource.metricFindQuery.mock.calls[0][0]).toBe('test.prod.*');
        });
        it('should delete last segment if no metrics are found', function () {
            expect(ctx.ctrl.segments[2].value).toBe('select metric');
        });
        it('should parse expression and build function model', function () {
            expect(ctx.ctrl.queryModel.functions.length).toBe(2);
        });
    });
    describe('when adding function', function () {
        beforeEach(function () {
            ctx.ctrl.target.target = 'test.prod.*.count';
            ctx.ctrl.datasource.metricFindQuery = function () { return Promise.resolve([{ expandable: false }]); };
            ctx.ctrl.parseTarget();
            ctx.ctrl.addFunction(gfunc.getFuncDef('aliasByNode'));
        });
        it('should add function with correct node number', function () {
            expect(ctx.ctrl.queryModel.functions[0].params[0]).toBe(2);
        });
        it('should update target', function () {
            expect(ctx.ctrl.target.target).toBe('aliasByNode(test.prod.*.count, 2)');
        });
        it('should call refresh', function () {
            expect(ctx.panelCtrl.refresh).toHaveBeenCalled();
        });
    });
    describe('when adding function before any metric segment', function () {
        beforeEach(function () {
            ctx.ctrl.target.target = '';
            ctx.ctrl.datasource.metricFindQuery = function () { return Promise.resolve([{ expandable: true }]); };
            ctx.ctrl.parseTarget();
            ctx.ctrl.addFunction(gfunc.getFuncDef('asPercent'));
        });
        it('should add function and remove select metric link', function () {
            expect(ctx.ctrl.segments.length).toBe(0);
        });
    });
    describe('when initializing target without metric expression and only function', function () {
        beforeEach(function () {
            ctx.ctrl.target.target = 'asPercent(#A, #B)';
            ctx.ctrl.datasource.metricFindQuery = function () { return Promise.resolve([]); };
            ctx.ctrl.parseTarget();
        });
        it('should not add select metric segment', function () {
            expect(ctx.ctrl.segments.length).toBe(1);
        });
        it('should add second series ref as param', function () {
            expect(ctx.ctrl.queryModel.functions[0].params.length).toBe(1);
        });
    });
    describe('when initializing a target with single param func using variable', function () {
        beforeEach(function () {
            ctx.ctrl.target.target = 'movingAverage(prod.count, $var)';
            ctx.ctrl.datasource.metricFindQuery = function () { return Promise.resolve([]); };
            ctx.ctrl.parseTarget();
        });
        it('should add 2 segments', function () {
            expect(ctx.ctrl.segments.length).toBe(2);
        });
        it('should add function param', function () {
            expect(ctx.ctrl.queryModel.functions[0].params.length).toBe(1);
        });
    });
    describe('when initializing target without metric expression and function with series-ref', function () {
        beforeEach(function () {
            ctx.ctrl.target.target = 'asPercent(metric.node.count, #A)';
            ctx.ctrl.datasource.metricFindQuery = function () { return Promise.resolve([]); };
            ctx.ctrl.parseTarget();
        });
        it('should add segments', function () {
            expect(ctx.ctrl.segments.length).toBe(3);
        });
        it('should have correct func params', function () {
            expect(ctx.ctrl.queryModel.functions[0].params.length).toBe(1);
        });
    });
    describe('when getting altSegments and metricFindQuery returns empty array', function () {
        beforeEach(function () {
            ctx.ctrl.target.target = 'test.count';
            ctx.ctrl.datasource.metricFindQuery = function () { return Promise.resolve([]); };
            ctx.ctrl.parseTarget();
            ctx.ctrl.getAltSegments(1).then(function (results) {
                ctx.altSegments = results;
            });
        });
        it('should have no segments', function () {
            expect(ctx.altSegments.length).toBe(0);
        });
    });
    describe('targetChanged', function () {
        beforeEach(function () {
            ctx.ctrl.target.target = 'aliasByNode(scaleToSeconds(test.prod.*, 1), 2)';
            ctx.ctrl.datasource.metricFindQuery = function () { return Promise.resolve([{ expandable: false }]); };
            ctx.ctrl.parseTarget();
            ctx.ctrl.target.target = '';
            ctx.ctrl.targetChanged();
        });
        it('should rebuild target after expression model', function () {
            expect(ctx.ctrl.target.target).toBe('aliasByNode(scaleToSeconds(test.prod.*, 1), 2)');
        });
        it('should call panelCtrl.refresh', function () {
            expect(ctx.panelCtrl.refresh).toHaveBeenCalled();
        });
    });
    describe('when updating targets with nested query', function () {
        beforeEach(function () {
            ctx.ctrl.target.target = 'scaleToSeconds(#A, 60)';
            ctx.ctrl.datasource.metricFindQuery = function () { return Promise.resolve([{ expandable: false }]); };
            ctx.ctrl.parseTarget();
        });
        it('should add function params', function () {
            expect(ctx.ctrl.queryModel.segments.length).toBe(1);
            expect(ctx.ctrl.queryModel.segments[0].value).toBe('#A');
            expect(ctx.ctrl.queryModel.functions[0].params.length).toBe(1);
            expect(ctx.ctrl.queryModel.functions[0].params[0]).toBe(60);
        });
        it('target should remain the same', function () {
            expect(ctx.ctrl.target.target).toBe('scaleToSeconds(#A, 60)');
        });
        it('targetFull should include nested queries', function () {
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
    describe('when updating target used in other query', function () {
        beforeEach(function () {
            ctx.ctrl.target.target = 'metrics.a.count';
            ctx.ctrl.target.refId = 'A';
            ctx.ctrl.datasource.metricFindQuery = function () { return Promise.resolve([{ expandable: false }]); };
            ctx.ctrl.parseTarget();
            ctx.ctrl.panelCtrl.panel.targets = [ctx.ctrl.target, { target: 'sumSeries(#A)', refId: 'B' }];
            ctx.ctrl.updateModelTarget();
        });
        it('targetFull of other query should update', function () {
            expect(ctx.ctrl.panel.targets[1].targetFull).toBe('sumSeries(metrics.a.count)');
        });
    });
    describe('when adding seriesByTag function', function () {
        beforeEach(function () {
            ctx.ctrl.target.target = '';
            ctx.ctrl.datasource.metricFindQuery = function () { return Promise.resolve([{ expandable: false }]); };
            ctx.ctrl.parseTarget();
            ctx.ctrl.addFunction(gfunc.getFuncDef('seriesByTag'));
        });
        it('should update functions', function () {
            expect(ctx.ctrl.queryModel.getSeriesByTagFuncIndex()).toBe(0);
        });
        it('should update seriesByTagUsed flag', function () {
            expect(ctx.ctrl.queryModel.seriesByTagUsed).toBe(true);
        });
        it('should update target', function () {
            expect(ctx.ctrl.target.target).toBe('seriesByTag()');
        });
        it('should call refresh', function () {
            expect(ctx.panelCtrl.refresh).toHaveBeenCalled();
        });
    });
    describe('when parsing seriesByTag function', function () {
        beforeEach(function () {
            ctx.ctrl.target.target = "seriesByTag('tag1=value1', 'tag2!=~value2')";
            ctx.ctrl.datasource.metricFindQuery = function () { return Promise.resolve([{ expandable: false }]); };
            ctx.ctrl.parseTarget();
        });
        it('should add tags', function () {
            var expected = [
                { key: 'tag1', operator: '=', value: 'value1' },
                { key: 'tag2', operator: '!=~', value: 'value2' },
            ];
            expect(ctx.ctrl.queryModel.tags).toEqual(expected);
        });
        it('should add plus button', function () {
            expect(ctx.ctrl.addTagSegments.length).toBe(1);
        });
    });
    describe('when tag added', function () {
        beforeEach(function () {
            ctx.ctrl.target.target = 'seriesByTag()';
            ctx.ctrl.datasource.metricFindQuery = function () { return Promise.resolve([{ expandable: false }]); };
            ctx.ctrl.parseTarget();
            ctx.ctrl.addNewTag({ value: 'tag1' });
        });
        it('should update tags with default value', function () {
            var expected = [{ key: 'tag1', operator: '=', value: '' }];
            expect(ctx.ctrl.queryModel.tags).toEqual(expected);
        });
        it('should update target', function () {
            var expected = "seriesByTag('tag1=')";
            expect(ctx.ctrl.target.target).toEqual(expected);
        });
    });
    describe('when tag changed', function () {
        beforeEach(function () {
            ctx.ctrl.target.target = "seriesByTag('tag1=value1', 'tag2!=~value2')";
            ctx.ctrl.datasource.metricFindQuery = function () { return Promise.resolve([{ expandable: false }]); };
            ctx.ctrl.parseTarget();
            ctx.ctrl.tagChanged({ key: 'tag1', operator: '=', value: 'new_value' }, 0);
        });
        it('should update tags', function () {
            var expected = [
                { key: 'tag1', operator: '=', value: 'new_value' },
                { key: 'tag2', operator: '!=~', value: 'value2' },
            ];
            expect(ctx.ctrl.queryModel.tags).toEqual(expected);
        });
        it('should update target', function () {
            var expected = "seriesByTag('tag1=new_value', 'tag2!=~value2')";
            expect(ctx.ctrl.target.target).toEqual(expected);
        });
    });
    describe('when tag removed', function () {
        beforeEach(function () {
            ctx.ctrl.target.target = "seriesByTag('tag1=value1', 'tag2!=~value2')";
            ctx.ctrl.datasource.metricFindQuery = function () { return Promise.resolve([{ expandable: false }]); };
            ctx.ctrl.parseTarget();
            ctx.ctrl.removeTag(0);
        });
        it('should update tags', function () {
            var expected = [{ key: 'tag2', operator: '!=~', value: 'value2' }];
            expect(ctx.ctrl.queryModel.tags).toEqual(expected);
        });
        it('should update target', function () {
            var expected = "seriesByTag('tag2!=~value2')";
            expect(ctx.ctrl.target.target).toEqual(expected);
        });
    });
});
//# sourceMappingURL=query_ctrl.test.js.map