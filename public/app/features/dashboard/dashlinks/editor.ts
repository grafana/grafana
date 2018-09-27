import angular from 'angular';
import _ from 'lodash';

export let iconMap = {
  'external link': 'fa-external-link',
  dashboard: 'fa-th-large',
  question: 'fa-question',
  info: 'fa-info',
  bolt: 'fa-bolt',
  doc: 'fa-file-text-o',
  cloud: 'fa-cloud',
};

export class DashLinkEditorCtrl {
  dashboard: any;
  iconMap: any;
  mode: any;
  link: any;

  /** @ngInject */
  constructor($scope, $rootScope) {
    this.iconMap = iconMap;
    this.dashboard.links = this.dashboard.links || [];
    this.mode = 'list';

    $scope.$on('$destroy', () => {
      $rootScope.appEvent('dash-links-updated');
    });
  }

  backToList() {
    this.mode = 'list';
  }

  setupNew() {
    this.mode = 'new';
    this.link = { type: 'dashboards', icon: 'external link' };
  }

  addLink() {
    this.dashboard.links.push(this.link);
    this.mode = 'list';
  }

  editLink(link) {
    this.link = link;
    this.mode = 'edit';
    console.log(this.link);
  }

  saveLink() {
    this.backToList();
  }

  moveLink(index, dir) {
    _.move(this.dashboard.links, index, index + dir);
  }

  deleteLink(index) {
    this.dashboard.links.splice(index, 1);
    this.dashboard.updateSubmenuVisibility();
  }
}

function dashLinksEditor() {
  return {
    restrict: 'E',
    controller: DashLinkEditorCtrl,
    templateUrl: 'public/app/features/dashboard/dashlinks/editor.html',
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: '=',
    },
  };
}

angular.module('grafana.directives').directive('dashLinksEditor', dashLinksEditor);
