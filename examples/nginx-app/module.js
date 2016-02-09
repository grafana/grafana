define([
  'angular',
  'app/app'
], function(angular, app)  {

  var module = angular.module('nginx-app', []);
  app.default.useModule(module);

  module.config(function($routeProvider) {
    $routeProvider
      .when('/nginx/stream', {
        templateUrl: 'public/plugins/nginx-app/partials/stream.html',
      });
  });

  function NginxConfigCtrl() {
    this.appEditCtrl.beforeUpdate = function() {
      alert('before!');
    };
  }
  NginxConfigCtrl.templateUrl = 'public/plugins/nginx-app/partials/config.html';


  return {
    ConfigCtrl: NginxConfigCtrl
  };

});
