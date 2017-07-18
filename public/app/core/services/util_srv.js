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
        templateUrl: options.src,
        persist: false,
        show: false,
        scope: options.scope,
        keyboard: false,
        placement: "center"
      });

      modal.$promise.then(modal.show);

      // $q.when(modal).then(modal.show);

    };

  });

});
