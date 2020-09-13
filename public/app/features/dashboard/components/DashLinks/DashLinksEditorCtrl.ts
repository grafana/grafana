import angular from 'angular';
import _ from 'lodash';
import { DashboardModel } from 'app/features/dashboard/state';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { CoreEvents } from 'app/types';

export let iconMap: { [key: string]: string } = {
  'external link': 'external-link-alt',
  dashboard: 'apps',
  question: 'question-circle',
  info: 'info-circle',
  bolt: 'bolt',
  doc: 'file-alt',
  cloud: 'cloud',
};

export class DashLinksEditorCtrl {
  dashboard: DashboardModel;
  iconMap: any;
  mode: any;
  link: any;

  emptyListCta = {
    title: 'There are no dashboard links added yet',
    buttonIcon: 'link',
    buttonTitle: 'Add Dashboard Link',
    infoBox: {
      __html: `<p>
      Dashboard Links allow you to place links to other dashboards and web sites directly below the dashboard
      header.
    </p>`,
    },
    infoBoxTitle: 'What are Dashboard Links?',
  };

  /** @ngInject */
  constructor($scope: any, $rootScope: GrafanaRootScope) {
    this.iconMap = iconMap;
    this.dashboard.links = this.dashboard.links || [];
    this.mode = 'list';

    $scope.$on('$destroy', () => {
      $rootScope.appEvent(CoreEvents.dashLinksUpdated);
    });
  }

  backToList() {
    this.mode = 'list';
  }

  setupNew = () => {
    this.mode = 'new';
    this.link = { type: 'dashboards', icon: 'external link' };
  };

  addLink() {
    this.dashboard.links = [...this.dashboard.links, this.link];
    this.mode = 'list';
    this.dashboard.updateSubmenuVisibility();
  }

  editLink(link: any) {
    this.link = link;
    this.mode = 'edit';
  }

  saveLink() {
    this.dashboard.links = _.cloneDeep(this.dashboard.links);
    this.backToList();
  }

  moveLink(index: string | number, dir: string | number) {
    // @ts-ignore
    _.move(this.dashboard.links, index, index + dir);
  }

  duplicateLink(link: any, index: number) {
    this.dashboard.links.splice(index, 0, link);
    this.dashboard.updateSubmenuVisibility();
  }

  deleteLink(index: number) {
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
