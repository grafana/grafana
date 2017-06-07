import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

import _ from 'lodash';
import {HistoryListCtrl} from 'app/features/dashboard/history/history';
import { versions, compare, restore } from 'test/mocks/history-mocks';
import config from 'app/core/config';

describe('HistoryListCtrl', function() {
  var RESTORE_ID = 4;

  var ctx: any = {};
  var versionsResponse: any = versions();
  var restoreResponse: any = restore(7, RESTORE_ID);

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(angularMocks.inject($rootScope => {
    ctx.scope = $rootScope.$new();
  }));

  var historySrv;
  var $rootScope;
  beforeEach(function() {
    historySrv = {
      getHistoryList: sinon.stub(),
      calculateDiff: sinon.stub(),
      restoreDashboard: sinon.stub(),
    };
    $rootScope = {
      appEvent: sinon.spy(),
      onAppEvent: sinon.spy(),
    };
  });

  describe('when the history list component is loaded', function() {
    var deferred;

    beforeEach(angularMocks.inject(($controller, $q) => {
      deferred = $q.defer();
      historySrv.getHistoryList.returns(deferred.promise);
      ctx.ctrl = $controller(HistoryListCtrl, {
        historySrv,
        $rootScope,
        $scope: ctx.scope,
      }, {
        dashboard: {
          id: 2,
          version: 3,
          formatDate: sinon.stub().returns('date'),
        }
      });
    }));

    it('should immediately attempt to fetch the history list', function() {
      expect(historySrv.getHistoryList.calledOnce).to.be(true);
    });

    describe('and the history list is successfully fetched', function() {
      beforeEach(function() {
        deferred.resolve(versionsResponse);
        ctx.ctrl.$scope.$apply();
      });

      it('should reset the controller\'s state', function() {
        expect(ctx.ctrl.mode).to.be('list');
        expect(ctx.ctrl.delta).to.eql({ basic: '', json: '' });
        expect(ctx.ctrl.canCompare).to.be(false);
        expect(_.find(ctx.ctrl.revisions, rev => rev.checked)).to.be.undefined;
      });

      it('should indicate loading has finished', function() {
        expect(ctx.ctrl.loading).to.be(false);
      });

      it('should store the revisions sorted desc by version id', function() {
        expect(ctx.ctrl.revisions[0].version).to.be(4);
        expect(ctx.ctrl.revisions[1].version).to.be(3);
        expect(ctx.ctrl.revisions[2].version).to.be(2);
        expect(ctx.ctrl.revisions[3].version).to.be(1);
      });

      it('should add a checked property to each revision', function() {
        var actual = _.filter(ctx.ctrl.revisions, rev => rev.hasOwnProperty('checked'));
        expect(actual.length).to.be(4);
      });

      it('should set all checked properties to false on reset', function() {
        ctx.ctrl.revisions[0].checked = true;
        ctx.ctrl.revisions[2].checked = true;
        ctx.ctrl.reset();
        var actual = _.filter(ctx.ctrl.revisions, rev => !rev.checked);
        expect(actual.length).to.be(4);
      });

    });

    describe('and fetching the history list fails', function() {
      beforeEach(function() {
        deferred.reject(new Error('HistoryListError'));
        ctx.ctrl.$scope.$apply();
      });

      it('should reset the controller\'s state', function() {
        expect(ctx.ctrl.mode).to.be('list');
        expect(ctx.ctrl.delta).to.eql({ basic: '', json: '' });
        expect(_.find(ctx.ctrl.revisions, rev => rev.checked)).to.be.undefined;
      });

      it('should indicate loading has finished', function() {
        expect(ctx.ctrl.loading).to.be(false);
      });

      it('should have an empty revisions list', function() {
        expect(ctx.ctrl.revisions).to.eql([]);
      });
    });

    describe('should update the history list when the dashboard is saved', function() {
      beforeEach(function() {
        ctx.ctrl.dashboard = {version: 3 };
        ctx.ctrl.resetFromSource = sinon.spy();
      });

      it('should listen for the `dashboard-saved` appEvent', function() {
        expect($rootScope.onAppEvent.calledOnce).to.be(true);
        expect($rootScope.onAppEvent.getCall(0).args[0]).to.be('dashboard-saved');
      });

      it('should call `onDashboardSaved` when the appEvent is received', function() {
        expect($rootScope.onAppEvent.getCall(0).args[1]).to.not.be(ctx.ctrl.onDashboardSaved);
        expect($rootScope.onAppEvent.getCall(0).args[1].toString).to.be(ctx.ctrl.onDashboardSaved.toString);
      });
    });
  });

  describe('when the user wants to compare two revisions', function() {
    var deferred;

    beforeEach(angularMocks.inject(($controller, $q) => {
      deferred = $q.defer();
      historySrv.getHistoryList.returns($q.when(versionsResponse));
      historySrv.calculateDiff.returns(deferred.promise);
      ctx.ctrl = $controller(HistoryListCtrl, {
        historySrv,
        $rootScope,
        $scope: ctx.scope,
      }, {
        dashboard: {
          id: 2,
          version: 3,
          formatDate: sinon.stub().returns('date'),
        }
      });

      ctx.ctrl.$scope.onDashboardSaved = sinon.spy();
      ctx.ctrl.$scope.$apply();
    }));

    it('should have already fetched the history list', function() {
      expect(historySrv.getHistoryList.calledOnce).to.be(true);
      expect(ctx.ctrl.revisions.length).to.be.above(0);
    });

    it('should check that two valid versions are selected', function() {
      // []
      expect(ctx.ctrl.canCompare).to.be(false);

      // single value
      ctx.ctrl.revisions = [{checked: true}];
      ctx.ctrl.revisionSelectionChanged();
      expect(ctx.ctrl.canCompare).to.be(false);

      // both values in range
      ctx.ctrl.revisions = [{checked: true}, {checked: true}];
      ctx.ctrl.revisionSelectionChanged();
      expect(ctx.ctrl.canCompare).to.be(true);
    });

    describe('and the basic diff is successfully fetched', function() {
      beforeEach(function() {
        deferred.resolve(compare('basic'));
        ctx.ctrl.revisions[1].checked = true;
        ctx.ctrl.revisions[3].checked = true;
        ctx.ctrl.getDiff('basic');
        ctx.ctrl.$scope.$apply();
      });

      it('should fetch the basic diff if two valid versions are selected', function() {
        expect(historySrv.calculateDiff.calledOnce).to.be(true);
        expect(ctx.ctrl.delta.basic).to.be('<div></div>');
        expect(ctx.ctrl.delta.json).to.be('');
      });

      it('should set the basic diff view as active', function() {
        expect(ctx.ctrl.mode).to.be('compare');
        expect(ctx.ctrl.diff).to.be('basic');
      });

      it('should indicate loading has finished', function() {
        expect(ctx.ctrl.loading).to.be(false);
      });
    });

    describe('and the json diff is successfully fetched', function() {
      beforeEach(function() {
        deferred.resolve(compare('json'));
        ctx.ctrl.revisions[1].checked = true;
        ctx.ctrl.revisions[3].checked = true;
        ctx.ctrl.getDiff('json');
        ctx.ctrl.$scope.$apply();
      });

      it('should fetch the json diff if two valid versions are selected', function() {
        expect(historySrv.calculateDiff.calledOnce).to.be(true);
        expect(ctx.ctrl.delta.basic).to.be('');
        expect(ctx.ctrl.delta.json).to.be('<pre><code></code></pre>');
      });

      it('should set the json diff view as active', function() {
        expect(ctx.ctrl.mode).to.be('compare');
        expect(ctx.ctrl.diff).to.be('json');
      });

      it('should indicate loading has finished', function() {
        expect(ctx.ctrl.loading).to.be(false);
      });
    });

    describe('and diffs have already been fetched', function() {
      beforeEach(function() {
        deferred.resolve(compare('basic'));
        ctx.ctrl.revisions[3].checked = true;
        ctx.ctrl.revisions[1].checked = true;
        ctx.ctrl.delta.basic = 'cached basic';
        ctx.ctrl.getDiff('basic');
        ctx.ctrl.$scope.$apply();
      });

      it('should use the cached diffs instead of fetching', function() {
        expect(historySrv.calculateDiff.calledOnce).to.be(false);
        expect(ctx.ctrl.delta.basic).to.be('cached basic');
      });

      it('should indicate loading has finished', function() {
        expect(ctx.ctrl.loading).to.be(false);
      });
    });

    describe('and fetching the diff fails', function() {
      beforeEach(function() {
        deferred.reject(new Error('DiffError'));
        ctx.ctrl.revisions[3].checked = true;
        ctx.ctrl.revisions[1].checked = true;
        ctx.ctrl.getDiff('basic');
        ctx.ctrl.$scope.$apply();
      });

      it('should fetch the diff if two valid versions are selected', function() {
        expect(historySrv.calculateDiff.calledOnce).to.be(true);
      });

      it('should return to the history list view', function() {
        expect(ctx.ctrl.mode).to.be('list');
      });

      it('should indicate loading has finished', function() {
        expect(ctx.ctrl.loading).to.be(false);
      });

      it('should have an empty delta/changeset', function() {
        expect(ctx.ctrl.delta).to.eql({ basic: '', json: '' });
      });
    });
  });

  describe('when the user wants to restore a revision', function() {
    var deferred;

    beforeEach(angularMocks.inject(($controller, $q) => {
      deferred = $q.defer();
      historySrv.getHistoryList.returns($q.when(versionsResponse));
      historySrv.restoreDashboard.returns(deferred.promise);
      ctx.ctrl = $controller(HistoryListCtrl, {
        historySrv,
        contextSrv: { user: { name: 'Carlos' }},
        $rootScope,
        $scope: ctx.scope,
      });
      ctx.ctrl.dashboard = { id: 1 };
      ctx.ctrl.restore();
      ctx.ctrl.$scope.$apply();
    }));

    it('should display a modal allowing the user to restore or cancel', function() {
      expect($rootScope.appEvent.calledOnce).to.be(true);
      expect($rootScope.appEvent.calledWith('confirm-modal')).to.be(true);
    });

    describe('and restore fails to fetch', function() {
      beforeEach(function() {
        deferred.reject(new Error('RestoreError'));
        ctx.ctrl.restoreConfirm(RESTORE_ID);
        try {
          // this throws error, due to promise rejection
          ctx.ctrl.$scope.$apply();
        } catch (e) {}
      });

      it('should indicate loading has finished', function() {
        expect(ctx.ctrl.loading).to.be(false);
      });

    });
  });
});
