///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import _ from 'lodash';
import $ from 'jquery';

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';

export class UtilSrv {

  /** @ngInject */
  constructor(private $rootScope, private $modal) {
  }

  init() {
    appEvents.on('show-modal', this.showModal.bind(this), this.$rootScope);
  }

  showModal(options) {
    if (options.model) {
      options.scope = this.$rootScope.$new();
      options.scope.model = options.model;
    }

    var modal = this.$modal({
      modalClass: options.modalClass,
      template: options.src,
      templateHtml: options.templateHtml,
      persist: false,
      show: false,
      scope: options.scope,
      keyboard: false,
      backdrop: options.backdrop
    });

    Promise.resolve(modal).then(function(modalEl) {
      modalEl.modal('show');
    });
  }
}

coreModule.service('utilSrv', UtilSrv);
