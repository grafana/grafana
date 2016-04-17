///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

var module = angular.module('grafana.directives');

export class QueryRowCtrl {
  collapsedText: string;
  canCollapse: boolean;
  getCollapsedText: any;
  target: any;
  queryCtrl: any;
  panelCtrl: any;
  panel: any;
  collapsed: any;

  constructor() {
    this.panelCtrl = this.queryCtrl.panelCtrl;
    this.target = this.queryCtrl.target;
    this.panel = this.panelCtrl.panel;

    this.toggleCollapse();

    if (this.target.isNew) {
      delete this.target.isNew;
      this.toggleCollapse();
    }

    if (!this.target.refId) {
      this.target.refId = this.getNextQueryLetter();
    }
  }

  toggleHideQuery() {
    this.target.hide = !this.target.hide;
    this.panelCtrl.refresh();
  }

  getNextQueryLetter() {
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    return _.find(letters, refId => {
      return _.every(this.panel.targets, function(other) {
        return other.refId !== refId;
      });
    });
  }

  toggleCollapse() {
    if (!this.canCollapse) {
      return;
    }

    this.collapsed = !this.collapsed;

    try {
      this.collapsedText = this.queryCtrl.getCollapsedText();
    } catch (e) {
      var err = e.message || e.toString();
      this.collapsedText = 'Error: ' + err;
    }
  }

  toggleEditorMode() {
    this.queryCtrl.toggleEditorMode();
  }

  removeQuery() {
    this.panel.targets = _.without(this.panel.targets, this.target);
    this.panelCtrl.refresh();
  }

  duplicateQuery() {
    var clone = angular.copy(this.target);
    clone.refId = this.getNextQueryLetter();
    this.panel.targets.push(clone);
  }

  moveQuery(direction) {
    var index = _.indexOf(this.panel.targets, this.target);
    _.move(this.panel.targets, index, index + direction);
  }
}

/** @ngInject **/
function queryEditorRowDirective() {
  return {
    restrict: 'E',
    controller: QueryRowCtrl,
    bindToController: true,
    controllerAs: "ctrl",
    templateUrl: 'public/app/features/panel/partials/query_editor_row.html',
    transclude: true,
    scope: {
      queryCtrl: "=",
      canCollapse: "=",
    },
  };
}

module.directive('queryEditorRow', queryEditorRowDirective);
