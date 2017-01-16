define([
  'app/features/dashboard/viewStateSrv'
], function() {
  'use strict';

  describe('when updating view state', function() {
    var viewState, location;
    var timeSrv = {};
    var templateSrv = {};
    var contextSrv = {
      user: {
        orgId: 19
      }
    };

    beforeEach(module('grafana.services'));
    beforeEach(module(function($provide) {
      $provide.value('timeSrv', timeSrv);
      $provide.value('templateSrv', templateSrv);
      $provide.value('contextSrv', contextSrv);
    }));

    beforeEach(inject(function(dashboardViewStateSrv, $location, $rootScope) {
      $rootScope.onAppEvent = function() {};
      $rootScope.dashboard = {meta: {}};
      viewState = dashboardViewStateSrv.create($rootScope);
      location = $location;
    }));

    describe('to fullscreen true and edit true', function() {
      it('should update querystring and view state', function() {
        var updateState = {fullscreen: true, edit: true, panelId: 1};
        viewState.update(updateState);
        expect(location.search()).to.eql({fullscreen: true, edit: true, panelId: 1});
        expect(viewState.dashboard.meta.fullscreen).to.be(true);
        expect(viewState.state.fullscreen).to.be(true);
      });
    });

    describe('to fullscreen false', function() {
      it('should remove params from query string', function() {
        viewState.update({fullscreen: true, panelId: 1, edit: true});
        viewState.update({fullscreen: false});
        expect(viewState.dashboard.meta.fullscreen).to.be(false);
        expect(viewState.state.fullscreen).to.be(null);
      });
    });

  });

});
