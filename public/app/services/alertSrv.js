define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('alertSrv', function($timeout, $sce, $rootScope, $modal, $q) {
    var self = this;

    this.init = function() {
      $rootScope.onAppEvent('alert-error', function(e, alert) {
        self.set(alert[0], alert[1], 'error');
      });
      $rootScope.onAppEvent('alert-warning', function(e, alert) {
        self.set(alert[0], alert[1], 'warning', 5000);
      });
      $rootScope.onAppEvent('alert-success', function(e, alert) {
        self.set(alert[0], alert[1], 'success', 3000);
      });
      $rootScope.onAppEvent('confirm-modal', this.showConfirmModal);
    };

    // List of all alert objects
    this.list = [];

    this.set = function(title,text,severity,timeout) {
      var newAlert = {
        title: title || '',
        text: text || '',
        severity: severity || 'info',
      };

      var newAlertJson = angular.toJson(newAlert);

      // remove same alert if it already exists
      _.remove(self.list, function(value) {
        return angular.toJson(value) === newAlertJson;
      });

      self.list.push(newAlert);
      if (timeout > 0) {
        $timeout(function() {
          self.list = _.without(self.list,newAlert);
        }, timeout);
      }

      return(newAlert);
    };

    this.clear = function(alert) {
      self.list = _.without(self.list,alert);
    };

    this.clearAll = function() {
      self.list = [];
    };

    this.showConfirmModal = function(e, payload) {
      var scope = $rootScope.$new();

      scope.title = payload.title;
      scope.text = payload.text;
      scope.onConfirm = payload.onConfirm;
      scope.icon = payload.icon || "fa-check";
      scope.yesText = payload.yesText || "Yes";
      scope.noText = payload.noText || "Cancel";

      var confirmModal = $modal({
        template: './app/partials/confirm_modal.html',
        persist: false,
        modalClass: 'modal-no-header confirm-modal',
        show: false,
        scope: scope,
        keyboard: false
      });

      $q.when(confirmModal).then(function(modalEl) {
        modalEl.modal('show');
      });

    };

  });
});
