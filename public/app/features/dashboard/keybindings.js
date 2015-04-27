define([
  'angular',
  'jquery',
],
function(angular, $) {
  "use strict";

  var module = angular.module('grafana.services');

  module.service('dashboardKeybindings', function($rootScope, keyboardManager, $modal, $q) {

    this.shortcuts = function(scope) {

      scope.$on('$destroy', function() {
        keyboardManager.unbindAll();
      });

      var helpModalScope = null;
      keyboardManager.bind('shift+?', function() {
        if (helpModalScope) { return; }

        helpModalScope = $rootScope.$new();
        var helpModal = $modal({
          template: './app/partials/help_modal.html',
          persist: false,
          show: false,
          scope: helpModalScope,
          keyboard: false
        });

        helpModalScope.$on('$destroy', function() { helpModalScope = null; });
        $q.when(helpModal).then(function(modalEl) { modalEl.modal('show'); });

      }, { inputDisabled: true });

      keyboardManager.bind('ctrl+f', function() {
        scope.appEvent('show-dash-search');
      }, { inputDisabled: true });

      keyboardManager.bind('ctrl+o', function() {
        var current = scope.dashboard.sharedCrosshair;
        scope.dashboard.sharedCrosshair = !current;
        scope.broadcastRefresh();
      }, { inputDisabled: true });

      keyboardManager.bind('ctrl+l', function() {
        scope.$broadcast('toggle-all-legends');
      }, { inputDisabled: true });

      keyboardManager.bind('ctrl+h', function() {
        var current = scope.dashboard.hideControls;
        scope.dashboard.hideControls = !current;
      }, { inputDisabled: true });

      keyboardManager.bind('ctrl+s', function(evt) {
        scope.appEvent('save-dashboard', evt);
      }, { inputDisabled: true });

      keyboardManager.bind('ctrl+r', function() {
        scope.broadcastRefresh();
      }, { inputDisabled: true });

      keyboardManager.bind('ctrl+z', function(evt) {
        scope.appEvent('zoom-out', evt);
      }, { inputDisabled: true });

      keyboardManager.bind('esc', function() {
        var popups = $('.popover.in');
        if (popups.length > 0) {
          return;
        }
        // close modals
        var modalData = $(".modal").data();
        if (modalData && modalData.$scope && modalData.$scope.dismiss) {
          modalData.$scope.dismiss();
        }

        scope.appEvent('hide-dash-editor');

        scope.exitFullscreen();
      }, { inputDisabled: true });
    };
  });
});
