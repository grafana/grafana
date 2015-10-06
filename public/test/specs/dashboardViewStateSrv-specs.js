define([
  'app/features/dashboard/viewStateSrv'
], function() {
  'use strict';

  describe('when updating view state', function() {
    var viewState, location;

    beforeEach(module('grafana.services'));

    beforeEach(inject(function(dashboardViewStateSrv, $location, $rootScope) {
      $rootScope.onAppEvent = function(){};
      viewState = dashboardViewStateSrv.create($rootScope);
      location = $location;
    }));

    describe('to fullscreen true and edit true', function() {
      it('should update querystring and view state', function() {
        var updateState = { fullscreen: true, edit: true, panelId: 1 };
        viewState.update(updateState);
        expect(location.search()).to.eql(updateState);
        expect(viewState.fullscreen).to.be(true);
        expect(viewState.state.fullscreen).to.be(true);
      });
    });

    describe('to fullscreen false', function() {
      it('should remove params from query string', function() {
        viewState.update({fullscreen: true, panelId: 1, edit: true});
        viewState.update({fullscreen: false});
        expect(location.search()).to.eql({});
        expect(viewState.fullscreen).to.be(false);
        expect(viewState.state.fullscreen).to.be(null);
      });
    });

  });

});
