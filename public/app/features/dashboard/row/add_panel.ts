///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';

import config from 'app/core/config';
import {coreModule} from 'app/core/core';

export class AddPanelCtrl {
  dashboard: any;
  allPanels: any;
  panelHits: any;
  activeIndex: any;
  panelSearch: any;

  /** @ngInject */
  constructor(private $rootScope, dashboardSrv) {
    this.dashboard = dashboardSrv.getCurrent();
    this.activeIndex = 0;

    this.allPanels = _.chain(config.panels)
      .filter({hideFromList: false})
      .map(item => item)
      .orderBy('sort')
      .value();

    this.panelHits = this.allPanels;
  }

  dismiss() {
    this.$rootScope.appEvent('hide-dash-editor');
  }

  keyDown(evt) {
    if (evt.keyCode === 27) {
      this.dismiss();
      return;
    }

    if (evt.keyCode === 40 || evt.keyCode === 39) {
      this.moveSelection(1);
    }

    if (evt.keyCode === 38 || evt.keyCode === 37) {
      this.moveSelection(-1);
    }

    if (evt.keyCode === 13) {
      var selectedPanel = this.panelHits[this.activeIndex];
      if (selectedPanel) {
        this.addPanel(selectedPanel);
      }
    }
  }

  moveSelection(direction) {
    var max = this.panelHits.length;
    var newIndex = this.activeIndex + direction;
    this.activeIndex = ((newIndex %= max) < 0) ? newIndex + max : newIndex;
  }

  panelSearchChanged() {
    var items = this.allPanels.slice();
    var startsWith = [];
    var contains = [];
    var searchLower = this.panelSearch.toLowerCase();
    var item;

    while (item = items.shift()) {
      var nameLower = item.name.toLowerCase();
      if (nameLower.indexOf(searchLower) === 0) {
        startsWith.push(item);
      } else if (nameLower.indexOf(searchLower) !== -1) {
        contains.push(item);
      }
    }

    this.panelHits = startsWith.concat(contains);
    this.activeIndex = 0;
  }

  addPanel(panelPluginInfo) {
    let defaultHeight = 6;
    let defaultWidth = 6;

    if (panelPluginInfo.id === "singlestat") {
      defaultWidth = 3;
      defaultHeight = 3;
    }

    this.dashboard.addPanel({
      type: panelPluginInfo.id,
      x: 0,
      y: 0,
      width: defaultWidth,
      height: defaultHeight,
      title: 'New panel',
    });

    this.dismiss();
  }
}

export function addPanelDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/row/add_panel.html',
    controller: AddPanelCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {},
  };
}

coreModule.directive('addPanel', addPanelDirective);
