///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';

import config from 'app/core/config';
import {coreModule, appEvents} from 'app/core/core';

export class AddPanelCtrl {
  row: any;
  dashboard: any;
  rowCtrl: any;
  allPanels: any;
  panelHits: any;
  activeIndex: any;
  panelSearch: any;

  /** @ngInject */
  constructor(private $scope, private $timeout, private $rootScope) {
    this.row = this.rowCtrl.row;
    this.dashboard = this.rowCtrl.dashboard;
    this.activeIndex = 0;

    this.allPanels = _.chain(config.panels)
      .filter({hideFromList: false})
      .map(item => item)
      .orderBy('sort')
      .value();

    this.panelHits = this.allPanels;
  }

  keyDown(evt) {
    if (evt.keyCode === 27) {
      this.rowCtrl.dropView = 0;
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
    var defaultSpan = 12;
    var span = 12 - this.row.span;

    var panel = {
      id: null,
      title: config.new_panel_title,
      span: span < defaultSpan && span > 0 ? span : defaultSpan,
      type: panelPluginInfo.id,
    };

    this.rowCtrl.closeDropView();
    this.dashboard.addPanel(panel, this.row);
    this.$timeout(() => {
      this.$rootScope.$broadcast('render');
      //this.$rootScope.appEvent('panel-change-view', {
      //  fullscreen: true, edit: true, panelId: panel.id
      //});
    });
  }
}

export function addPanelDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/row/add_panel.html',
    controller: AddPanelCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      rowCtrl: "=",
    },
  };
}

coreModule.directive('dashRowAddPanel', addPanelDirective);
