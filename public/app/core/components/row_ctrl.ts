///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';

export class DashboardRowCtrl {
  static template = `
    <a class="dashboard-row__title pointer" ng-click="ctrl.toggle()">
      <span class="dashboard-row__chevron">
        <i class="fa fa-chevron-down" ng-hide="ctrl.isCollapsed"></i>
        <i class="fa fa-chevron-right" ng-show="ctrl.isCollapsed"></i>
      </span>
      <span class="dashboard-row__title-text">{{ctrl.panel.title | interpolateTemplateVars:this}}</span>
    </a>
    <div class="dashboard-row__actions">
      <a class="pointer" ng-click="ctrl.moveUp()"><span class="fa fa-arrow-up"></i></a>
      <a class="pointer" ng-click="ctrl.moveDown()"><span class="fa fa-arrow-down"></i></a>
      <a class="pointer" ng-click="ctrl.openSettings()"><span class="fa fa-cog"></i></a>
    </div>
  `;

  dashboard: any;
  panel: any;

  constructor(private $rootScope) {
    this.panel.hiddenPanels = this.panel.hiddenPanels || [];
  }

  toggle() {
    if (this.panel.collapse) {
      let panelIndex = _.indexOf(this.dashboard.panels, this.panel);

      for (let child of this.panel.hiddenPanels) {
        this.dashboard.panels.splice(panelIndex+1, 0, child);
        child.y = this.panel.y+1;
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

  link(scope, elem) {
    elem.addClass('dashboard-row');

    scope.$watch('ctrl.panel.collapse', () => {
      elem.toggleClass('dashboard-row--collapse', this.panel.collapse === true);
    });
  }
}

