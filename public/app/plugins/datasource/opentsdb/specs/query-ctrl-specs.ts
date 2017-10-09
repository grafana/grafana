import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';
import helpers from 'test/specs/helpers';
import {OpenTsQueryCtrl} from "../query_ctrl";

describe('OpenTsQueryCtrl', function() {
  var ctx = new helpers.ControllerTestContext();

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(angularMocks.module(function($compileProvider) {
    $compileProvider.preAssignBindingsEnabled(true);
  }));

  beforeEach(ctx.providePhase(['backendSrv','templateSrv']));

  beforeEach(ctx.providePhase());
  beforeEach(angularMocks.inject(($rootScope, $controller, $q) => {
    ctx.$q = $q;
    ctx.scope = $rootScope.$new();
    ctx.target = {target: ''};
    ctx.panelCtrl = {
      panel: {
        targets: [ctx.target]
      }
    };
    ctx.panelCtrl.refresh = sinon.spy();
    ctx.datasource.getAggregators = sinon.stub().returns(ctx.$q.when([]));
    ctx.datasource.getFilterTypes = sinon.stub().returns(ctx.$q.when([]));

    ctx.ctrl = $controller(OpenTsQueryCtrl, {$scope: ctx.scope}, {
      panelCtrl: ctx.panelCtrl,
      datasource: ctx.datasource,
      target: ctx.target,
    });
    ctx.scope.$digest();
  }));

  describe('init query_ctrl variables', function() {

    it('filter types should be initialized', function() {
      expect(ctx.ctrl.filterTypes.length).to.be(7);
    });

    it('aggregators should be initialized', function() {
      expect(ctx.ctrl.aggregators.length).to.be(8);
    });

    it('fill policy options should be initialized', function() {
      expect(ctx.ctrl.fillPolicies.length).to.be(4);
    });

  });

  describe('when adding filters and tags', function() {

    it('addTagMode should be false when closed', function() {
      ctx.ctrl.addTagMode = true;
      ctx.ctrl.closeAddTagMode();
      expect(ctx.ctrl.addTagMode).to.be(false);
    });

    it('addFilterMode should be false when closed', function() {
      ctx.ctrl.addFilterMode = true;
      ctx.ctrl.closeAddFilterMode();
      expect(ctx.ctrl.addFilterMode).to.be(false);
    });

    it('removing a tag from the tags list', function() {
      ctx.ctrl.target.tags = {"tagk": "tag_key", "tagk2": "tag_value2"};
      ctx.ctrl.removeTag("tagk");
      expect(Object.keys(ctx.ctrl.target.tags).length).to.be(1);
    });

    it('removing a filter from the filters list', function() {
      ctx.ctrl.target.filters = [{"tagk": "tag_key", "filter": "tag_value2", "type": "wildcard", "groupBy": true}];
      ctx.ctrl.removeFilter(0);
      expect(ctx.ctrl.target.filters.length).to.be(0);
    });

    it('adding a filter when tags exist should generate error', function() {
      ctx.ctrl.target.tags = {"tagk": "tag_key", "tagk2": "tag_value2"};
      ctx.ctrl.addFilter();
      expect(ctx.ctrl.errors.filters).to.be('Please remove tags to use filters, tags and filters are mutually exclusive.');
    });

    it('adding a tag when filters exist should generate error', function() {
      ctx.ctrl.target.filters = [{"tagk": "tag_key", "filter": "tag_value2", "type": "wildcard", "groupBy": true}];
      ctx.ctrl.addTag();
      expect(ctx.ctrl.errors.tags).to.be('Please remove filters to use tags, tags and filters are mutually exclusive.');
    });

  });

});
