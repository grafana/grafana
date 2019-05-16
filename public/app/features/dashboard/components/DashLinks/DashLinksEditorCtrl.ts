import angular from 'angular';
import _ from 'lodash';
import { DashboardModel } from 'app/features/dashboard/state';

export let iconMap = {
  'external link': 'fa-external-link',
  dashboard: 'fa-th-large',
  question: 'fa-question',
  info: 'fa-info',
  bolt: 'fa-bolt',
  doc: 'fa-file-text-o',
  cloud: 'fa-cloud',
};

export class DashLinksEditorCtrl {
  dashboard: DashboardModel;
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
    this.dashboard.updateSubmenuVisibility();
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
    // @ts-ignore
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
    controller: DashLinksEditorCtrl,
    templateUrl: 'public/app/features/dashboard/components/DashLinks/editor.html',
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: '=',
    },
  };
}

angular.module('grafana.directives').directive('dashLinksEditor', dashLinksEditor);
