import angular from 'angular';

const coreModule = angular.module('grafana.core', ['ngRoute']);

// legacy modules
const angularModules = [
  coreModule,
  angular.module('grafana.controllers', []),
  angular.module('grafana.directives', []),
  angular.module('grafana.factories', []),
  angular.module('grafana.services', []),
  angular.module('grafana.filters', []),
  angular.module('grafana.routes', []),
];

export { angularModules, coreModule };

export default coreModule;
