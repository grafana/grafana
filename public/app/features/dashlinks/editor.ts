import angular from 'angular';
import _ from 'lodash';
import appEvents from 'app/core/app_events';

export var iconMap = {
  "external link": "fa-external-link",
  "dashboard": "fa-th-large",
  "question": "fa-question",
  "info": "fa-info",
  "bolt": "fa-bolt",
  "doc": "fa-file-text-o",
  "cloud": "fa-cloud",
};

export class DashLinkEditorCtrl {
  dashboard: any;
  iconMap: any;
  mode: any;
  link: any;
  currentLink: any;

  /** @ngInject */
  constructor($scope, $rootScope) {
    this.iconMap = iconMap;
    this.dashboard.links = this.dashboard.links || [];
    this.mode = 'list';
  }

  backToList() {
    this.mode = 'list';
  }

  addLinkMode() {
    this.mode = 'new';
  }

  editLinkMode(index) {
    this.currentLink = index;
    this.mode = 'edit';
  }

  addLink(type, tags) {
    this.dashboard.links.push({ type: type, tags: tags, icon: 'external link' });
    this.dashboard.updateSubmenuVisibility();
    this.updated();
    this.mode = 'list';
  }

  editLink(index) {

  }

  moveLink(index, dir) {
    _.move(this.dashboard.links, index, index+dir);
    this.updated();
  }

  updated() {
    appEvents.emit('dash-links-updated');
  }

  deleteLink(index) {
    this.dashboard.links.splice(index, 1);
    this.dashboard.updateSubmenuVisibility();
    this.updated();
  }
}

function dashLinksEditor() {
  return {
    restrict: 'E',
    controller: DashLinkEditorCtrl,
    templateUrl: 'public/app/features/dashlinks/editor.html',
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: "="
    }
  };
}

angular.module('grafana.directives').directive('dashLinksEditor', dashLinksEditor);
