define([
  'angular',
  '../core_module',
],
function (angular, coreModule) {
  'use strict';

  coreModule.service('utilSrv', function($rootScope, $modal, $q) {

    this.init = function() {
      $rootScope.onAppEvent('show-modal', this.showModal, $rootScope);
    };

    this.showModal = function(e, options) {
      var modal = $modal({
        modalClass: options.modalClass,
        template: options.src,
        persist: false,
        show: false,
        scope: options.scope,
        keyboard: false
      });

      $q.when(modal).then(function(modalEl) {
        modalEl.modal('show');
      });
    };

  });

});
