import { deprecationWarning } from '@grafana/data';
import { appEvents } from 'app/core/app_events';

import { HideModalEvent, ShowModalEvent } from '../../types/events';

/**
 * Old legacy utilSrv exposed to angular services and handles angular modals.
 * Not used by any core or known external plugin.
 */
export class UtilSrv {
  modalScope: any;

  /** @ngInject */
  constructor() {}

  init() {
    appEvents.subscribe(ShowModalEvent, (e) => this.showModal(e.payload));
    appEvents.subscribe(HideModalEvent, this.hideModal.bind(this));
  }

  /**
   * @deprecated use showModalReact instead that has this capability built in
   */
  hideModal() {
    deprecationWarning('UtilSrv', 'hideModal', '');
    if (this.modalScope && this.modalScope.dismiss) {
      this.modalScope.dismiss();
    }
  }

  /**
   * @deprecated
   */
  showModal(options: any) {
    deprecationWarning('UtilSrv', 'showModal', 'publish ShowModalReactEvent');
  }
}
