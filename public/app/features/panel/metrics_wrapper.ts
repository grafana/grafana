import coreModule from 'app/core/core_module';

/** @ngInject */
export function metricsWrapperDirective() {
  'use strict';
  return {
    restrict: 'E',
    scope: true,
    template: `<plugin-component type="query-ctrl"> </plugin-component>`,
    link: $scope => {
      $scope.panelCtrl = $scope.ctrl;
      $scope.ctrl = $scope.panelCtrl;
      $scope.panel = $scope.panelCtrl.panel;
      $scope.panel.datasource = $scope.panel.datasource || null;
      $scope.panel.targets = $scope.panel.targets || [{}];
      $scope.events = $scope.panelCtrl.events;
      $scope.refresh = $scope.panelCtrl.refresh;
      $scope.dashboard = $scope.panelCtrl.dashboard;
    },
  };
}

coreModule.directive('metricsWrapper', metricsWrapperDirective);
