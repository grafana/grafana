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
      link: this.link
    };
  }

  link(scope, elem) {
    return null;
  }
}

export {
  PanelCtrl,
  MetricsPanelCtrl,
  PanelDirective,
}
