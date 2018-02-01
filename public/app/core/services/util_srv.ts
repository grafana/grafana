import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';

export class UtilSrv {
  modalScope: any;

  /** @ngInject */
  constructor(private $rootScope, private $modal) {}

  init() {
    appEvents.on('show-modal', this.showModal.bind(this), this.$rootScope);
    appEvents.on('hide-modal', this.hideModal.bind(this), this.$rootScope);
  }

  hideModal() {
    if (this.modalScope && this.modalScope.dismiss) {
      this.modalScope.dismiss();
    }
  }

  showModal(options) {
    if (this.modalScope && this.modalScope.dismiss) {
      this.modalScope.dismiss();
    }

    this.modalScope = options.scope;

    if (options.model) {
      this.modalScope = this.$rootScope.$new();
      this.modalScope.model = options.model;
    } else if (!this.modalScope) {
      this.modalScope = this.$rootScope.$new();
    }

    var modal = this.$modal({
      modalClass: options.modalClass,
      template: options.src,
      templateHtml: options.templateHtml,
      persist: false,
      show: false,
      scope: this.modalScope,
      keyboard: false,
      backdrop: options.backdrop,
    });

    Promise.resolve(modal).then(function(modalEl) {
      modalEl.modal('show');
    });
  }
}

coreModule.service('utilSrv', UtilSrv);
