define([
  'angular',
  'kbn'
],
function (angular) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('topnav', function($rootScope, contextSrv) {
      return {
        restrict: 'E',
        transclude: true,
        scope: {
          title: "@",
          section: "@",
          titleAction: "&",
          subnav: "=",
        },
        template:
          '<div class="navbar navbar-static-top"><div class="navbar-inner"><div class="container-fluid">' +
          '<div class="top-nav">' +
            '<a class="top-nav-menu-btn pointer" ng-if="!contextSrv.sidemenu" ng-click="toggle()">' +
              '<i class="logo collapsed icon-rt-raintank_icn"></i> ' +
              '<i class="fa fa-bars"></i>' +
            '</a>' +

            '<span class="icon-circle top-nav-icon">' +
              '<i ng-class="icon"></i>' +
            '</span>' +

            '<span ng-show="section">' +
              '<span class="top-nav-title">{{section}}</span>' +
              '<i class="top-nav-breadcrumb-icon fa fa-angle-right"></i>' +
            '</span>' +

            //'<a ng-click="titleAction()" class="top-nav-title">' +
              //'{{title}}' +
            //'</a>' +
            '<i ng-show="subnav" class="top-nav-breadcrumb-icon fa fa-angle-right"></i>' +
          '</div><div ng-transclude></div></div></div></div>',
        link: function(scope, elem, attrs) {
          scope.icon = attrs.icon;
          scope.contextSrv = contextSrv;

          scope.toggle = function() {
            $rootScope.appEvent('toggle-sidemenu');
          };
        }
      };
    });

});
