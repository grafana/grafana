///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import coreModule from 'app/core/core_module';

export class DashRowCtrl {
  showTitle: boolean;

   /** @ngInject */
  constructor(private $scope, private $rootScope) {
    this.showTitle = true;
    this.-
  }

}


export function rowDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/row/row.html',
    controller: DashRowCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: "=",
      row: "=",
    }
  };
}

coreModule.directive('dashRow', rowDirective);


coreModule.directive('panelWidth', function($rootScope) {

  return function(scope, element) {
    var fullscreen = false;

    function updateWidth() {
      if (!fullscreen) {
        element[0].style.width = ((scope.panel.span / 1.2) * 10) + '%';
      }
    }

    $rootScope.onAppEvent('panel-fullscreen-enter', function(evt, info) {
      fullscreen = true;

      if (scope.panel.id !== info.panelId) {
        element.hide();
      } else {
        element[0].style.width = '100%';
      }
    }, scope);

    $rootScope.onAppEvent('panel-fullscreen-exit', function(evt, info) {
      fullscreen = false;

      if (scope.panel.id !== info.panelId) {
        element.show();
      }

      updateWidth();
    }, scope);

    scope.$watch('ctrl.panel.span', updateWidth);

    if (fullscreen) {
      element.hide();
    }
  };
});

