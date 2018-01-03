///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';

export class DashboardRowCtrl {
  static template = `
    <div class="dashboard-row__center">
      <div class="dashboard-row__actions-left">
        <i class="fa fa-chevron-down" ng-hide="ctrl.panel.collapse"></i>
        <i class="fa fa-chevron-right" ng-show="ctrl.panel.collapse"></i>
      </div>
      <a class="dashboard-row__title pointer" ng-click="ctrl.toggle()">
        <span class="dashboard-row__title-text">
          {{ctrl.panel.title | interpolateTemplateVars:this}}
        </span>
      </a>
      <div class="dashboard-row__actions-right">
        <a class="pointer" ng-click="ctrl.openSettings()"><span class="fa fa-cog"></i></a>
      </div>
    </div>

  <div class="dashboard-row__panel_count">
    ({{ctrl.panel.hiddenPanels.length}} hidden panels)
  </div>
  <div class="dashboard-row__drag grid-drag-handle">
  </div>
  `;

  dashboard: any;
  panel: any;

  constructor() {
    this.panel.hiddenPanels = this.panel.hiddenPanels || [];
  }

  toggle() {
    if (this.panel.collapse) {
      let panelIndex = _.indexOf(this.dashboard.panels, this.panel);

      for (let child of this.panel.hiddenPanels) {
        this.dashboard.panels.splice(panelIndex + 1, 0, child);
        child.y = this.panel.y + 1;
        console.log('restoring child', child);
      }

      this.panel.hiddenPanels = [];
      this.panel.collapse = false;
      return;
    }

    this.panel.collapse = true;
    let foundRow = false;

    for (let i = 0; i < this.dashboard.panels.length; i++) {
      let panel = this.dashboard.panels[i];

      if (panel === this.panel) {
        console.log('found row');
        foundRow = true;
        continue;
      }

      if (!foundRow) {
        continue;
      }

      if (panel.type === 'row') {
        break;
      }

      this.panel.hiddenPanels.push(panel);
      console.log('hiding child', panel.id);
    }

    for (let hiddenPanel of this.panel.hiddenPanels) {
      this.dashboard.removePanel(hiddenPanel, false);
    }
  }

  moveUp() {
    // let panelIndex = _.indexOf(this.dashboard.panels, this.panel);
    // let rowAbove = null;
    // for (let index = panelIndex-1; index > 0; index--) {
    //   panel = this.dashboard.panels[index];
    //   if (panel.type === 'row') {
    //     rowAbove = panel;
    //   }
    // }
    //
    // if (rowAbove) {
    //   this.panel.y = rowAbove.y;
    // }
  }

  link(scope, elem) {
    elem.addClass('dashboard-row');

    scope.$watch('ctrl.panel.collapse', () => {
      elem.toggleClass('dashboard-row--collapse', this.panel.collapse === true);
    });
  }
}
