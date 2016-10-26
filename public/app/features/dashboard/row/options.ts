///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';

import config from 'app/core/config';
import {coreModule, appEvents} from 'app/core/core';

export class RowOptionsCtrl {
  row: any;
  dashboard: any;
  rowCtrl: any;
  subTabIndex: number;
  allPanels: any;
  panelHits: any;
  activeIndex: any;
  panelSearch: any;

  fontSizes = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

  /** @ngInject */
  constructor(private $scope, private $timeout, private $rootScope) {
    this.row = this.rowCtrl.row;
    this.dashboard = this.rowCtrl.dashboard;
    this.subTabIndex = 0;
    this.row.titleSize = this.row.titleSize || 'h6';
    this.allPanels = _.orderBy(_.map(config.panels, item => item), 'sort');
    this.panelHits = this.allPanels;
    this.activeIndex = 0;
  }

  keyDown(evt) {
    if (evt.keyCode === 27) {
      this.rowCtrl.showOptions = false;
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
    var _as = 12 - this.dashboard.rowSpan(this.row);

    var panel = {
      id: null,
      title: config.new_panel_title,
      error: false,
      span: _as < defaultSpan && _as > 0 ? _as : defaultSpan,
      editable: true,
      type: panelPluginInfo.id,
      isNew: true,
    };

    this.rowCtrl.showOptions = false;
    this.dashboard.addPanel(panel, this.row);
    this.$timeout(() => {
      this.$rootScope.appEvent('panel-change-view', {
        fullscreen: true, edit: true, panelId: panel.id
      });
    });
  }

  deleteRow() {
    if (!this.row.panels.length) {
      this.dashboard.rows = _.without(this.dashboard.rows, this.row);
      return;
    }

    appEvents.emit('confirm-modal', {
      title: 'Delete',
      text: 'Are you sure you want to delete this row?',
      icon: 'fa-trash',
      yesText: 'Delete',
      onConfirm: () => {
        this.dashboard.rows = _.without(this.dashboard.rows, this.row);
      }
    });
  }

}

export function rowOptionsDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/row/options.html',
    controller: RowOptionsCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      rowCtrl: "=",
    },
  };
}

coreModule.directive('dashRowOptions', rowOptionsDirective);
