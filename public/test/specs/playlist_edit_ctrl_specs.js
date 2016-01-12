define([
  './helpers',
  'lodash',
  'app/core/services/backend_srv',
  'app/features/playlist/playlist_edit_ctrl',
], function(helpers, _) {
  'use strict';

  describe('PlaylistEditCtrl', function() {
    var ctx = new helpers.ControllerTestContext();
    var playlist = {
      id: 1
    };
    var playlistDashboards = [
      {
        id: 2
      }
    ];
    var dashboards = [
      {
        id: 2
      },
      {
        id: 3
      }
    ];

    beforeEach(module('ngMock'));
    beforeEach(module('grafana.core'));
    beforeEach(module('grafana.controllers'));
    beforeEach(module('grafana.services'));
    beforeEach(ctx.providePhase({
      playlistSrv: {},
      $route: {
        current: {
          params: {
            id: 1
          }
        }
      }
    }));
    beforeEach(inject(function($location, $httpBackend, $rootScope) {
      $location.path('/playlists/edit/' + playlist.id);
      $rootScope.$apply();

      $httpBackend.whenGET(/^\/api\/playlists\/\d+$/).respond(playlist);
      $httpBackend.whenGET(/^\/api\/playlists\/\d+\/dashboards$/).respond(playlistDashboards);
      $httpBackend.whenGET(/^\/api\/search/).respond(dashboards);

      ctx.createControllerPhase('PlaylistEditCtrl');
      $httpBackend.flush();
      $rootScope.$apply();
    }));

    it('should load playlist and its dashboards from url', function() {
      expect(ctx.scope.playlist).to.eql(playlist);
      expect(ctx.scope.dashboards).to.eql(playlistDashboards);
    });

    it('should remove playlist`s dashboards from search result', function() {
      expect(_.find(ctx.scope.filteredDashboards, playlistDashboards[0])).to.not.be.ok();
    });

    it('should add dashboard', function() {
      var dashboard = ctx.scope.filteredDashboards[0];

      ctx.scope.addDashboard(dashboard);
      expect(_.find(ctx.scope.dashboards, dashboard)).to.be.ok();
      expect(_.find(ctx.scope.filteredDashboards, dashboard)).to.not.be.ok();
    });

    it('should remove dashboard', function() {
      var dashboard = ctx.scope.dashboards[0];

      ctx.scope.removeDashboard(dashboard);
      expect(_.find(ctx.scope.filteredDashboards, dashboard)).to.be.ok();
      expect(_.find(ctx.scope.dashboards, dashboard)).to.not.be.ok(-1);
    });

  });

});

