define([
  'angular',
  'lodash',
  'store',
  'config',
],
function (angular, _, store, config) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('contextSrv', function($rootScope, $timeout) {
    var self = this;

    function User() {
      if (window.grafanaBootData.user) {
        _.extend(this, window.grafanaBootData.user);
      }
    }

    // events
    $rootScope.$on('toggle-sidemenu', function() {
      self.toggleSideMenu();
    });

    this.hasRole = function(role) {
      return this.user.orgRole === role;
    };

    this.setSideMenuState = function(state) {
      this.sidemenu = state;
      store.set('grafana.sidemenu', state);
    };

    this.toggleSideMenu = function() {
      this.setSideMenuState(!this.sidemenu);

      $timeout(function() {
        $rootScope.$broadcast("render");
      }, 50);
    };

    this.version = config.buildInfo.version;
    this.lightTheme = false;
    this.user = new User();
    this.isSignedIn = this.user.isSignedIn;
    this.isGrafanaAdmin = this.user.isGrafanaAdmin;
    var sidemenuDefault = false;
    if (this.hasRole('Admin')) {
      sidemenuDefault = true;
    }
    this.sidemenu = store.getBool('grafana.sidemenu', sidemenuDefault);
    if (this.isSignedIn && !store.exists('grafana.sidemenu')) {
      // If the sidemnu has never been set before, set it to false.
      // This will result in this.sidemenu and the localStorage grafana.sidemenu
      // to be out of sync if the user has an admin role.  But this is
      // intentional and results in the user seeing the sidemenu only on
      // their first login.
      store.set('grafana.sidemenu', false);
    }
    this.isEditor = this.hasRole('Editor') || this.hasRole('Admin');
  });
});
