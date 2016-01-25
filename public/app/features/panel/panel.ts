///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';

import {PanelCtrl} from './panel_ctrl';
import {MetricsPanelCtrl} from './metrics_panel_ctrl';

class PanelDirective {
  template: string;
  templateUrl: string;
  bindToController: boolean;
  scope: any;
  controller: any;
  controllerAs: string;

  getDirective() {
    if (!this.controller) {
      this.controller = PanelCtrl;
    }

    return {
      template: this.template,
      templateUrl: this.templateUrl,
      controller: this.controller,
      controllerAs: 'ctrl',
      bindToController: true,
      scope: {dashboard: "=", panel: "=", row: "="},
      link: (scope, elem, attrs, ctrl) => {
        ctrl.init();
        this.link(scope, elem, attrs, ctrl);
      }
    };
  }

  link(scope, elem, attrs, ctrl) {
    return null;
  }
}

export {
  PanelCtrl,
  MetricsPanelCtrl,
  PanelDirective,
}
