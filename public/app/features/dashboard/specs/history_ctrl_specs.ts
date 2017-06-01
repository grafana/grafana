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
      compareVersions: sinon.stub(),
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
        expect(ctx.ctrl.delta).to.eql({ basic: '', html: '' });
        expect(ctx.ctrl.selected.length).to.be(0);
        expect(ctx.ctrl.selected).to.eql([]);
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
        ctx.ctrl.selected = [0, 2];
        ctx.ctrl.reset();
        var actual = _.filter(ctx.ctrl.revisions, rev => !rev.checked);
        expect(actual.length).to.be(4);
        expect(ctx.ctrl.selected).to.eql([]);
      });

      it('should add a default message to versions without a message', function() {
        expect(ctx.ctrl.revisions[0].message).to.be('Dashboard saved');
      });

      it('should add a message to revisions restored from another version', function() {
        expect(ctx.ctrl.revisions[1].message).to.be('Restored from version 1');
      });

      it('should add a message to entries that overwrote version history', function() {
        expect(ctx.ctrl.revisions[2].message).to.be('Dashboard overwritten');
      });

      it('should add a message to the initial dashboard save', function() {
        expect(ctx.ctrl.revisions[3].message).to.be('Dashboard\'s initial save');
      });
    });

    describe('and fetching the history list fails', function() {
      beforeEach(function() {
        deferred.reject(new Error('HistoryListError'));
        ctx.ctrl.$scope.$apply();
      });

      it('should reset the controller\'s state', function() {
        expect(ctx.ctrl.mode).to.be('list');
        expect(ctx.ctrl.delta).to.eql({ basic: '', html: '' });
        expect(ctx.ctrl.selected.length).to.be(0);
        expect(ctx.ctrl.selected).to.eql([]);
        expect(_.find(ctx.ctrl.revisions, rev => rev.checked)).to.be.undefined;
      });

      it('should indicate loading has finished', function() {
        expect(ctx.ctrl.loading).to.be(false);
      });

      it('should broadcast an event indicating the failure', function() {
        expect($rootScope.appEvent.calledOnce).to.be(true);
        expect($rootScope.appEvent.calledWith('alert-error')).to.be(true);
      });

      it('should have an empty revisions list', function() {
        expect(ctx.ctrl.revisions).to.eql([]);
      });
    });

    describe('should update the history list when the dashboard is saved', function() {
      beforeEach(function() {
        ctx.ctrl.dashboard = { version: 3 };
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

      it('should emit an appEvent to hide the changelog', function() {
        ctx.ctrl.onDashboardSaved();
        expect($rootScope.appEvent.calledOnce).to.be(true);
        expect($rootScope.appEvent.getCall(0).args[0]).to.be('hide-dash-editor');
      });
    });
  });

  describe('when the user wants to compare two revisions', function() {
    var deferred;

    beforeEach(angularMocks.inject(($controller, $q) => {
      deferred = $q.defer();
      historySrv.getHistoryList.returns($q.when(versionsResponse));
      historySrv.compareVersions.returns(deferred.promise);
      ctx.ctrl = $controller(HistoryListCtrl, {
        historySrv,
        $rootScope,
        $scope: ctx.scope,
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
      expect(ctx.ctrl.isComparable()).to.be(false);

      // single value
      ctx.ctrl.selected = [4];
      expect(ctx.ctrl.isComparable()).to.be(false);

      // both values in range
      ctx.ctrl.selected = [4, 2];
      expect(ctx.ctrl.isComparable()).to.be(true);

      // values out of range
      ctx.ctrl.selected = [7, 4];
      expect(ctx.ctrl.isComparable()).to.be(false);
    });

    describe('and the basic diff is successfully fetched', function() {
      beforeEach(function() {
        deferred.resolve(compare('basic'));
        ctx.ctrl.selected = [3, 1];
        ctx.ctrl.getDiff('basic');
        ctx.ctrl.$scope.$apply();
      });

      it('should fetch the basic diff if two valid versions are selected', function() {
        expect(historySrv.compareVersions.calledOnce).to.be(true);
        expect(ctx.ctrl.delta.basic).to.be('<div></div>');
        expect(ctx.ctrl.delta.html).to.be('');
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
        deferred.resolve(compare('html'));
        ctx.ctrl.selected = [3, 1];
        ctx.ctrl.getDiff('html');
        ctx.ctrl.$scope.$apply();
      });

      it('should fetch the json diff if two valid versions are selected', function() {
        expect(historySrv.compareVersions.calledOnce).to.be(true);
        expect(ctx.ctrl.delta.basic).to.be('');
        expect(ctx.ctrl.delta.html).to.be('<pre><code></code></pre>');
      });

      it('should set the json diff view as active', function() {
        expect(ctx.ctrl.mode).to.be('compare');
        expect(ctx.ctrl.diff).to.be('html');
      });

      it('should indicate loading has finished', function() {
        expect(ctx.ctrl.loading).to.be(false);
      });
    });

    describe('and diffs have already been fetched', function() {
      beforeEach(function() {
        deferred.resolve(compare('basic'));
        ctx.ctrl.selected = [3, 1];
        ctx.ctrl.delta.basic = 'cached basic';
        ctx.ctrl.getDiff('basic');
        ctx.ctrl.$scope.$apply();
      });

      it('should use the cached diffs instead of fetching', function() {
        expect(historySrv.compareVersions.calledOnce).to.be(false);
        expect(ctx.ctrl.delta.basic).to.be('cached basic');
      });

      it('should indicate loading has finished', function() {
        expect(ctx.ctrl.loading).to.be(false);
      });
    });

    describe('and fetching the diff fails', function() {
      beforeEach(function() {
        deferred.reject(new Error('DiffError'));
        ctx.ctrl.selected = [4, 2];
        ctx.ctrl.getDiff('basic');
        ctx.ctrl.$scope.$apply();
      });

      it('should fetch the diff if two valid versions are selected', function() {
        expect(historySrv.compareVersions.calledOnce).to.be(true);
      });

      it('should return to the history list view', function() {
        expect(ctx.ctrl.mode).to.be('list');
      });

      it('should indicate loading has finished', function() {
        expect(ctx.ctrl.loading).to.be(false);
      });

      it('should broadcast an event indicating the failure', function() {
        expect($rootScope.appEvent.calledOnce).to.be(true);
        expect($rootScope.appEvent.calledWith('alert-error')).to.be(true);
      });

      it('should have an empty delta/changeset', function() {
        expect(ctx.ctrl.delta).to.eql({ basic: '', html: '' });
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
      ctx.ctrl.$scope.setupDashboard = sinon.stub();
      ctx.ctrl.dashboard = { id: 1 };
      ctx.ctrl.restore();
      ctx.ctrl.$scope.$apply();
    }));

    it('should display a modal allowing the user to restore or cancel', function() {
      expect($rootScope.appEvent.calledOnce).to.be(true);
      expect($rootScope.appEvent.calledWith('confirm-modal')).to.be(true);
    });

    describe('from the diff view', function() {
      it('should return to the list view on restore', function() {
        ctx.ctrl.mode = 'compare';
        deferred.resolve(restoreResponse);
        ctx.ctrl.restoreConfirm(RESTORE_ID);
        ctx.ctrl.$scope.$apply();
        expect(ctx.ctrl.mode).to.be('list');
      });
    });

    describe('and restore is selected and successful', function() {
      beforeEach(function() {
        deferred.resolve(restoreResponse);
        ctx.ctrl.restoreConfirm(RESTORE_ID);
        ctx.ctrl.$scope.$apply();
      });

      it('should indicate loading has finished', function() {
        expect(ctx.ctrl.loading).to.be(false);
      });

      it('should add an entry for the restored revision to the history list', function() {
        expect(ctx.ctrl.revisions.length).to.be(5);
      });

      describe('the restored revision', function() {
        var first;
        beforeEach(function() { first = ctx.ctrl.revisions[0]; });

        it('should have its `id` and `version` numbers incremented', function() {
          expect(first.id).to.be(5);
          expect(first.version).to.be(5);
        });

        it('should set `parentVersion` to the reverted version', function() {
          expect(first.parentVersion).to.be(RESTORE_ID);
        });

        it('should set `dashboardId` to the dashboard\'s id', function() {
          expect(first.dashboardId).to.be(1);
        });

        it('should set `created` to date to the current time', function() {
          expect(_.isDate(first.created)).to.be(true);
        });

        it('should set `createdBy` to the username of the user who reverted', function() {
          expect(first.createdBy).to.be('Carlos');
        });

        it('should set `message` to the user\'s commit message', function() {
          expect(first.message).to.be('Restored from version 4');
        });
      });

      it('should reset the controller\'s state', function() {
        expect(ctx.ctrl.mode).to.be('list');
        expect(ctx.ctrl.delta).to.eql({ basic: '', html: '' });
        expect(ctx.ctrl.selected.length).to.be(0);
        expect(ctx.ctrl.selected).to.eql([]);
        expect(_.find(ctx.ctrl.revisions, rev => rev.checked)).to.be.undefined;
      });

      it('should set the dashboard object to the response dashboard data', function() {
        expect(ctx.ctrl.dashboard).to.eql(restoreResponse.dashboard.dashboard);
        expect(ctx.ctrl.dashboard.meta).to.eql(restoreResponse.dashboard.meta);
      });

      it('should call setupDashboard to render new revision', function() {
        expect(ctx.ctrl.$scope.setupDashboard.calledOnce).to.be(true);
        expect(ctx.ctrl.$scope.setupDashboard.getCall(0).args[0]).to.eql(restoreResponse.dashboard);
      });
    });

    describe('and restore fails to fetch', function() {
      beforeEach(function() {
        deferred.reject(new Error('RestoreError'));
        ctx.ctrl.restoreConfirm(RESTORE_ID);
        ctx.ctrl.$scope.$apply();
      });

      it('should indicate loading has finished', function() {
        expect(ctx.ctrl.loading).to.be(false);
      });

      it('should broadcast an event indicating the failure', function() {
        expect($rootScope.appEvent.callCount).to.be(2);
        expect($rootScope.appEvent.getCall(0).calledWith('confirm-modal')).to.be(true);
        expect($rootScope.appEvent.getCall(1).args[0]).to.be('alert-error');
        expect($rootScope.appEvent.getCall(1).args[1][0]).to.be('There was an error restoring the dashboard');
      });

      // TODO: test state after failure i.e. do we hide the modal or keep it visible
    });
  });
});
