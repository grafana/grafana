import { GrafanaRootScope } from 'app/angular/GrafanaCtrl';
import { HideModalEvent, ShowModalEvent } from '../../types/events';
import { deprecationWarning } from '@grafana/data';
import { appEvents } from 'app/core/app_events';

/**
 * Old legacy utilSrv exposed to angular services and handles angular modals.
 * Not used by any core or known external plugin.
 */
export class UtilSrv {
  modalScope: any;

  /** @ngInject */
  constructor(private $rootScope: GrafanaRootScope, private $modal: any) {}

  init() {
    appEvents.subscribe(ShowModalEvent, (e) => this.showModal(e.payload));
    appEvents.subscribe(HideModalEvent, this.hideModal.bind(this));
  }

  /**
   * @deprecated use showModalReact instead that has this capability built in
   */
  hideModal() {
    deprecationWarning('UtilSrv', 'hideModal', 'showModalReact');
    if (this.modalScope && this.modalScope.dismiss) {
      this.modalScope.dismiss();
    }
  }

  /**
   * @deprecated use showModalReact instead
   */
  showModal(options: any) {
    deprecationWarning('UtilSrv', 'showModal', 'showModalReact');
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

    const modal = this.$modal({
      modalClass: options.modalClass,
      template: options.src,
      templateHtml: options.templateHtml,
      persist: false,
      show: false,
      scope: this.modalScope,
      keyboard: false,
      backdrop: options.backdrop,
    });

    Promise.resolve(modal).then((modalEl) => {
      modalEl.modal('show');
    });
  }
}
