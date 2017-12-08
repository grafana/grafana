import {coreModule, appEvents} from 'app/core/core';
import {DashboardModel} from '../dashboard_model';
import $ from 'jquery';
import _ from 'lodash';

export class SettingsCtrl {
  dashboard: DashboardModel;
  isOpen: boolean;
  viewId: string;

  sections: any[] = [
    {title: 'General',     id: 'settings'},
    {title: 'Annotations', id: 'annotations'},
    {title: 'Templating',  id: 'templating'},
    {title: 'Versions',    id: 'versions'},
  ];

  /** @ngInject */
  constructor($scope, private $location, private $rootScope) {
    const params = this.$location.search();
    const url = $location.path();

    for (let section of this.sections) {
      const sectionParams = _.defaults({editview: section.id}, params);
      section.url = url + '?' + $.param(sectionParams);
      console.log(section.url);
    }

    this.viewId = params.editview;
    $rootScope.onAppEvent("$routeUpdate", this.onRouteUpdated.bind(this), $scope);
  }

  onRouteUpdated() {
    console.log('settings route updated');
    this.viewId = this.$location.search().editview;
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
