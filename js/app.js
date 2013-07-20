/*jshint globalstrict:true */
/*global angular:true */
'use strict';

// Base modules
var modules = [
  'kibana.services',
  'kibana.controllers', 
  'kibana.filters', 
  'kibana.directives', 
  'elasticjs.service',
  '$strap.directives',
  'kibana.panels',
  'ngSanitize',
];

var scripts = [];

var labjs = $LAB
  .script("common/lib/jquery-1.8.0.min.js").wait()
  .script("common/lib/modernizr-2.6.1.min.js")
  .script("common/lib/angular.min.js").wait()
  .script("common/lib/angular-strap.min.js")
  .script("common/lib/angular-sanitize.min.js")
  .script("common/lib/elastic.min.js")
  .script("common/lib/elastic-angular-client.js").wait()
  .script("common/lib/moment.js")
  .script("common/lib/filesaver.js")
  .script("common/lib/bootstrap.min.js")
  .script('common/lib/datepicker.js')
  .script('common/lib/timepicker.js').wait()
  .script("js/shared.js")
  .script("js/services.js")
  .script("js/controllers.js")
  .script("js/filters.js")
  .script("js/directives.js")
  .script("js/panels.js").wait();

_.each(config.modules, function(v) {
  labjs = labjs.script('panels/'+v+'/module.js');
  modules.push('kibana.'+v);
});

/* Application level module which depends on filters, controllers, and services */
labjs.wait(function(){
  angular.module('kibana', modules).config(['$routeProvider', function($routeProvider) {
      $routeProvider
        .when('/dashboard', {
          templateUrl: 'partials/dashboard.html',
        })
        .when('/dashboard/:type/:id', {
          templateUrl: 'partials/dashboard.html',
        })
        .when('/dashboard/:type/:id/:params', {
          templateUrl: 'partials/dashboard.html'
        })
        .otherwise({
          redirectTo: 'dashboard'
        });
    }]);
  angular.element(document).ready(function() {
    $('body').attr('ng-controller', 'DashCtrl');
    angular.bootstrap(document, ['kibana']);
  });
});
