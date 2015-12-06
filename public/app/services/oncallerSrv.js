define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('oncallerSrv', function($timeout, $sce, $rootScope, $modal, $q) {
    var self = this;

    this.init = function() {
      $rootScope.onAppEvent('oncaller-error', function(e, oncaller) {
        self.set(oncaller[0], oncaller[1], 'error');
      }, $rootScope);
      $rootScope.onAppEvent('oncaller-warning', function(e, oncaller) {
        self.set(oncaller[0], oncaller[1], 'warning', 5000);
      }, $rootScope);
      $rootScope.onAppEvent('oncaller-success', function(e, oncaller) {
        self.set(oncaller[0], oncaller[1], 'success', 3000);
      }, $rootScope);
      $rootScope.onAppEvent('confirm-modal', this.showConfirmModal, $rootScope);
    };

    // List of all oncaller objects
    this.list = [];

    this.set = function(title,text,severity,timeout) {
      var newoncaller = {
        title: title || '',
        text: text || '',
        severity: severity || 'info',
      };

      var newoncallerJson = angular.toJson(newoncaller);

      // remove same oncaller if it already exists
      _.remove(self.list, function(value) {
        return angular.toJson(value) === newoncallerJson;
      });

      self.list.push(newoncaller);
      if (timeout > 0) {
        $timeout(function() {
          self.list = _.without(self.list,newoncaller);
        }, timeout);
      }

      return(newoncaller);
    };

    this.clear = function(oncaller) {
      self.list = _.without(self.list,oncaller);
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
