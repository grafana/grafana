import {coreModule, appEvents} from 'app/core/core';
import {DashboardModel} from '../dashboard_model';

export class SettingsCtrl {
  dashboard: DashboardModel;
  isOpen: boolean;
  viewId: string;

  sections: any[] = [
    {title: 'General',     id: 'general'},
    {title: 'Annotations', id: 'annotations'},
    {title: 'Templating',  id: 'templating'},
    {title: 'Versions',    id: 'versions'},
  ];

  /** @ngInject */
  constructor($scope, private $location, private $rootScope) {
    appEvents.on('hide-dash-editor', this.hideSettings.bind(this), $scope);

    var urlParams = this.$location.search();
    this.viewId = urlParams.editview;
  }

  hideSettings() {
    var urlParams = this.$location.search();
    delete urlParams.editview;
    setTimeout(() => {
      this.$rootScope.$apply(() => {
        this.$location.search(urlParams);
      });
    });
  }
}

export function dashboardSettings() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/settings/settings.html',
    controller: SettingsCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    transclude: true,
    scope: { dashboard: "=" }
  };
}

coreModule.directive('dashboardSettings', dashboardSettings);
