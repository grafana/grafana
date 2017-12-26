import coreModule from 'app/core/core_module';
import { appEvents } from 'app/core/core';

class PanelClipboardSrv {
  key = 'GrafanaDashboardClipboardPanel';

  /** @ngInject **/
  constructor(private $window) {
    appEvents.on('copy-dashboard-panel', this.copyDashboardPanel.bind(this));
  }

  getPanel() {
    return this.$window[this.key];
  }

  private copyDashboardPanel(payload) {
    this.$window[this.key] = payload;
  }
}

coreModule.service('panelClipboardSrv', PanelClipboardSrv);
