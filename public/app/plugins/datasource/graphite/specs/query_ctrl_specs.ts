import 'app/core/services/segment_srv';
import { describe, beforeEach, it, sinon, expect, angularMocks } from 'test/lib/common';

import gfunc from '../gfunc';
import helpers from 'test/specs/helpers';
import { GraphiteQueryCtrl } from '../query_ctrl';

describe('GraphiteQueryCtrl', function() {
  var ctx = new helpers.ControllerTestContext();

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.controllers'));
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(
    angularMocks.module(function($compileProvider) {
      $compileProvider.preAssignBindingsEnabled(true);
    })
  );

  beforeEach(ctx.providePhase());
  beforeEach(
    angularMocks.inject(($rootScope, $controller, $q) => {
      ctx.$q = $q;
      ctx.scope = $rootScope.$new();
      ctx.target = { target: 'aliasByNode(scaleToSeconds(test.prod.*,1),2)' };
      ctx.datasource.metricFindQuery = sinon.stub().returns(ctx.$q.when([]));
      ctx.datasource.getFuncDefs = sinon.stub().returns(ctx.$q.when(gfunc.getFuncDefs('1.0')));
      ctx.datasource.getFuncDef = gfunc.getFuncDef;
      ctx.datasource.waitForFuncDefsLoaded = sinon.stub().returns(ctx.$q.when(null));
      ctx.datasource.createFuncInstance = gfunc.createFuncInstance;
      ctx.panelCtrl = { panel: {} };
      ctx.panelCtrl = {
        panel: {
          targets: [ctx.target],
        },
      };
      ctx.panelCtrl.refresh = sinon.spy();

      ctx.ctrl = $controller(
        GraphiteQueryCtrl,
        { $scope: ctx.scope },
        {
          panelCtrl: ctx.panelCtrl,
          datasource: ctx.datasource,
          target: ctx.target,
        }
      );
      ctx.scope.$digest();
    })
  );

  describe('init', function() {
    it('should validate metric key exists', function() {
      expect(ctx.datasource.metricFindQuery.getCall(0).args[0]).to.be('test.prod.*');
    });

    it('should delete last segment if no metrics are found', function() {
      expect(ctx.ctrl.segments[2].value).to.be('select metric');
    });

    it('should parse expression and build function model', function() {
      expect(ctx.ctrl.queryModel.functions.length).to.be(2);
    });
  });

  describe('when adding function', function() {
    beforeEach(function() {
      ctx.ctrl.target.target = 'test.prod.*.count';
      ctx.ctrl.datasource.metricFindQuery = sinon.stub().returns(ctx.$q.when([{ expandable: false }]));
      ctx.ctrl.parseTarget();
      ctx.ctrl.addFunction(gfunc.getFuncDef('aliasByNode'));
    });

    it('should add function with correct node number', function() {
      expect(ctx.ctrl.queryModel.functions[0].params[0]).to.be(2);
    });

    it('should update target', function() {
      expect(ctx.ctrl.target.target).to.be('aliasByNode(test.prod.*.count, 2)');
    });

    it('should call refresh', function() {
      expect(ctx.panelCtrl.refresh.called).to.be(true);
    });
  });

  describe('when adding function before any metric segment', function() {
    beforeEach(function() {
      ctx.ctrl.target.target = '';
      ctx.ctrl.datasource.metricFindQuery.returns(ctx.$q.when([{ expandable: true }]));
      ctx.ctrl.parseTarget();
      ctx.ctrl.addFunction(gfunc.getFuncDef('asPercent'));
    });

    it('should add function and remove select metric link', function() {
      expect(ctx.ctrl.segments.length).to.be(0);
    });
  });

  describe('when initalizing target without metric expression and only function', function() {
    beforeEach(function() {
      ctx.ctrl.target.target = 'asPercent(#A, #B)';
      ctx.ctrl.datasource.metricFindQuery.returns(ctx.$q.when([]));
      ctx.ctrl.parseTarget();
      ctx.scope.$digest();
    });

    it('should not add select metric segment', function() {
      expect(ctx.ctrl.segments.length).to.be(1);
    });

    it('should add second series ref as param', function() {
      expect(ctx.ctrl.queryModel.functions[0].params.length).to.be(1);
    });
  });

  describe('when initializing a target with single param func using variable', function() {
    beforeEach(function() {
      ctx.ctrl.target.target = 'movingAverage(prod.count, $var)';
      ctx.ctrl.datasource.metricFindQuery.returns(ctx.$q.when([]));
      ctx.ctrl.parseTarget();
    });

    it('should add 2 segments', function() {
      expect(ctx.ctrl.segments.length).to.be(2);
    });

    it('should add function param', function() {
      expect(ctx.ctrl.queryModel.functions[0].params.length).to.be(1);
    });
  });

  describe('when initalizing target without metric expression and function with series-ref', function() {
    beforeEach(function() {
      ctx.ctrl.target.target = 'asPercent(metric.node.count, #A)';
      ctx.ctrl.datasource.metricFindQuery.returns(ctx.$q.when([]));
      ctx.ctrl.parseTarget();
    });

    it('should add segments', function() {
      expect(ctx.ctrl.segments.length).to.be(3);
    });

    it('should have correct func params', function() {
      expect(ctx.ctrl.queryModel.functions[0].params.length).to.be(1);
    });
  });

  describe('when getting altSegments and metricFindQuery retuns empty array', function() {
    beforeEach(function() {
      ctx.ctrl.target.target = 'test.count';
      ctx.ctrl.datasource.metricFindQuery.returns(ctx.$q.when([]));
      ctx.ctrl.parseTarget();
      ctx.ctrl.getAltSegments(1).then(function(results) {
        ctx.altSegments = results;
      });
      ctx.scope.$digest();
    });

    it('should have no segments', function() {
      expect(ctx.altSegments.length).to.be(0);
    });
  });

  describe('targetChanged', function() {
    beforeEach(function() {
      ctx.ctrl.datasource.metricFindQuery = sinon.stub().returns(ctx.$q.when([{ expandable: false }]));
      ctx.ctrl.parseTarget();
      ctx.ctrl.target.target = '';
      ctx.ctrl.targetChanged();
    });

    it('should rebuld target after expression model', function() {
      expect(ctx.ctrl.target.target).to.be('aliasByNode(scaleToSeconds(test.prod.*, 1), 2)');
    });

    it('should call panelCtrl.refresh', function() {
      expect(ctx.panelCtrl.refresh.called).to.be(true);
    });
  });

  describe('when updating targets with nested query', function() {
    beforeEach(function() {
      ctx.ctrl.target.target = 'scaleToSeconds(#A, 60)';
      ctx.ctrl.datasource.metricFindQuery = sinon.stub().returns(ctx.$q.when([{ expandable: false }]));
      ctx.ctrl.parseTarget();
    });

    it('should add function params', function() {
      expect(ctx.ctrl.queryModel.segments.length).to.be(1);
      expect(ctx.ctrl.queryModel.segments[0].value).to.be('#A');

      expect(ctx.ctrl.queryModel.functions[0].params.length).to.be(1);
      expect(ctx.ctrl.queryModel.functions[0].params[0]).to.be(60);
    });

    it('target should remain the same', function() {
      expect(ctx.ctrl.target.target).to.be('scaleToSeconds(#A, 60)');
    });

    it('targetFull should include nested queries', function() {
      ctx.ctrl.panelCtrl.panel.targets = [
        {
          target: 'nested.query.count',
          refId: 'A',
        },
      ];

      ctx.ctrl.updateModelTarget();

      expect(ctx.ctrl.target.target).to.be('scaleToSeconds(#A, 60)');

      expect(ctx.ctrl.target.targetFull).to.be('scaleToSeconds(nested.query.count, 60)');
    });
  });

  describe('when updating target used in other query', function() {
    beforeEach(function() {
      ctx.ctrl.target.target = 'metrics.a.count';
      ctx.ctrl.target.refId = 'A';
      ctx.ctrl.datasource.metricFindQuery = sinon.stub().returns(ctx.$q.when([{ expandable: false }]));
      ctx.ctrl.parseTarget();

      ctx.ctrl.panelCtrl.panel.targets = [ctx.ctrl.target, { target: 'sumSeries(#A)', refId: 'B' }];

      ctx.ctrl.updateModelTarget();
    });

    it('targetFull of other query should update', function() {
      expect(ctx.ctrl.panel.targets[1].targetFull).to.be('sumSeries(metrics.a.count)');
    });
  });

  describe('when adding seriesByTag function', function() {
    beforeEach(function() {
      ctx.ctrl.target.target = '';
      ctx.ctrl.datasource.metricFindQuery = sinon.stub().returns(ctx.$q.when([{ expandable: false }]));
      ctx.ctrl.parseTarget();
      ctx.ctrl.addFunction(gfunc.getFuncDef('seriesByTag'));
    });

    it('should update functions', function() {
      expect(ctx.ctrl.queryModel.getSeriesByTagFuncIndex()).to.be(0);
    });

    it('should update seriesByTagUsed flag', function() {
      expect(ctx.ctrl.queryModel.seriesByTagUsed).to.be(true);
    });

    it('should update target', function() {
      expect(ctx.ctrl.target.target).to.be('seriesByTag()');
    });

    it('should call refresh', function() {
      expect(ctx.panelCtrl.refresh.called).to.be(true);
    });
  });

  describe('when parsing seriesByTag function', function() {
    beforeEach(function() {
      ctx.ctrl.target.target = "seriesByTag('tag1=value1', 'tag2!=~value2')";
      ctx.ctrl.datasource.metricFindQuery = sinon.stub().returns(ctx.$q.when([{ expandable: false }]));
      ctx.ctrl.parseTarget();
    });

    it('should add tags', function() {
      const expected = [
        { key: 'tag1', operator: '=', value: 'value1' },
        { key: 'tag2', operator: '!=~', value: 'value2' },
      ];
      expect(ctx.ctrl.queryModel.tags).to.eql(expected);
    });

    it('should add plus button', function() {
      expect(ctx.ctrl.addTagSegments.length).to.be(1);
    });
  });

  describe('when tag added', function() {
    beforeEach(function() {
      ctx.ctrl.target.target = 'seriesByTag()';
      ctx.ctrl.datasource.metricFindQuery = sinon.stub().returns(ctx.$q.when([{ expandable: false }]));
      ctx.ctrl.parseTarget();
      ctx.ctrl.addNewTag({ value: 'tag1' });
    });

    it('should update tags with default value', function() {
      const expected = [{ key: 'tag1', operator: '=', value: '' }];
      expect(ctx.ctrl.queryModel.tags).to.eql(expected);
    });

    it('should update target', function() {
      const expected = "seriesByTag('tag1=')";
      expect(ctx.ctrl.target.target).to.eql(expected);
    });
  });

  describe('when tag changed', function() {
    beforeEach(function() {
      ctx.ctrl.target.target = "seriesByTag('tag1=value1', 'tag2!=~value2')";
      ctx.ctrl.datasource.metricFindQuery = sinon.stub().returns(ctx.$q.when([{ expandable: false }]));
      ctx.ctrl.parseTarget();
      ctx.ctrl.tagChanged({ key: 'tag1', operator: '=', value: 'new_value' }, 0);
    });

    it('should update tags', function() {
      const expected = [
        { key: 'tag1', operator: '=', value: 'new_value' },
        { key: 'tag2', operator: '!=~', value: 'value2' },
      ];
      expect(ctx.ctrl.queryModel.tags).to.eql(expected);
    });

    it('should update target', function() {
      const expected = "seriesByTag('tag1=new_value', 'tag2!=~value2')";
      expect(ctx.ctrl.target.target).to.eql(expected);
    });
  });

  describe('when tag removed', function() {
    beforeEach(function() {
      ctx.ctrl.target.target = "seriesByTag('tag1=value1', 'tag2!=~value2')";
      ctx.ctrl.datasource.metricFindQuery = sinon.stub().returns(ctx.$q.when([{ expandable: false }]));
      ctx.ctrl.parseTarget();
      ctx.ctrl.removeTag(0);
    });

    it('should update tags', function() {
      const expected = [{ key: 'tag2', operator: '!=~', value: 'value2' }];
      expect(ctx.ctrl.queryModel.tags).to.eql(expected);
    });

    it('should update target', function() {
      const expected = "seriesByTag('tag2!=~value2')";
      expect(ctx.ctrl.target.target).to.eql(expected);
    });
  });
});
