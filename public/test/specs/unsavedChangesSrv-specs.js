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
      $provide.value('$window', {});
    }));

    beforeEach(inject(function(unsavedChangesSrv, $location, $rootScope, dashboardSrv) {
      _unsavedChangesSrv = unsavedChangesSrv;
      _dashboardSrv = dashboardSrv;
      _location = $location;
      _rootScope = $rootScope;
    }));

    beforeEach(function() {
      dash = _dashboardSrv.create({
        rows: [
          {
            panels: [{ test: "asd", legend: { } }]
          }
        ]
      });
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

    it('Should ignore a lot of changes', function() {
      dash.time = {from: '1h'};
      dash.refresh = true;
      dash.schemaVersion = 10;
      expect(tracker.hasChanges()).to.be(false);
    });

    it('Should ignore row collapse change', function() {
      dash.rows[0].collapse = true;
      expect(tracker.hasChanges()).to.be(false);
    });

    it('Should ignore panel legend changes', function() {
      dash.rows[0].panels[0].legend.sortDesc = true;
      dash.rows[0].panels[0].legend.sort = "avg";
      expect(tracker.hasChanges()).to.be(false);
    });

    it('Should ignore panel repeats', function() {
      dash.rows[0].panels.push({repeatPanelId: 10});
      expect(tracker.hasChanges()).to.be(false);
    });

    it('Should ignore row repeats', function() {
      dash.rows.push({repeatRowId: 10});
      expect(tracker.hasChanges()).to.be(false);
    });

  });
});
