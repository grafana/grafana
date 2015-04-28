define([
  'features/dashboard/unsavedChangesSrv',
  'features/dashboard/dashboardSrv'
], function() {
  'use strict';

  describe("unsavedChangesSrv", function() {
    var _unsavedChangesSrv;
    var _dashboardSrv;
    var _location;
    var _contextSrvStub = { isEditor: true };
    var _rootScope;
    var tracker;
    var dash;
    var scope;

    beforeEach(module('grafana.services'));
    beforeEach(module(function($provide) {
      $provide.value('contextSrv', _contextSrvStub);
    }));

    beforeEach(inject(function(unsavedChangesSrv, $location, $rootScope, dashboardSrv) {
      _unsavedChangesSrv = unsavedChangesSrv;
      _dashboardSrv = dashboardSrv;
      _location = $location;
      _rootScope = $rootScope;
    }));

    beforeEach(function() {
      dash = _dashboardSrv.create({});
      scope = _rootScope.$new();
      scope.appEvent = sinon.spy();
      scope.onAppEvent = sinon.spy();

      tracker = new _unsavedChangesSrv.Tracker(dash, scope);
    });

    it('No changes should not have changes', function() {
      expect(tracker.hasChanges()).to.be(false);
    });

    it('Simple change should be registered', function() {
      dash.property = "google";
      expect(tracker.hasChanges()).to.be(true);
    });

  });
});
