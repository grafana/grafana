define([
  '../core_module',
],
function (coreModule) {
  'use strict';

  coreModule.default.directive('topnav', function($rootScope, contextSrv) {
    return {
      restrict: 'E',
      transclude: true,
      scope: {
        title: "@",
        section: "@",
        titleUrl: "@",
        subnav: "=",
      },
      template:
        '<div class="navbar navbar-static-top"><div class="navbar-inner"><div class="container-fluid">' +
        '<div class="top-nav">' +
				'<div class="top-nav-btn top-nav-menu-btn">' +
					'<a class="pointer" ng-click="contextSrv.toggleSideMenu()">' +
						'<span class="top-nav-logo-background">' +
							'<img class="logo-icon" src="img/fav32.png"></img>' +
						'</span>' +
						'<i class="fa fa-caret-down"></i>' +
					'</a>' +
				'</div>' +

        '<span class="icon-circle top-nav-icon">' +
        '<i ng-class="icon"></i>' +
        '</span>' +

        '<span ng-show="section">' +
        '<span class="top-nav-title">{{section}}</span>' +
        '<i class="top-nav-breadcrumb-icon fa fa-angle-right"></i>' +
        '</span>' +

        '<a ng-href="{{titleUrl}}" class="top-nav-title">' +
        '{{title}}' +
        '</a>' +
        '<i ng-show="subnav" class="top-nav-breadcrumb-icon fa fa-angle-right"></i>' +
        '</div><div ng-transclude></div></div></div></div>',
      link: function(scope, elem, attrs) {
        scope.icon = attrs.icon;
        scope.contextSrv = contextSrv;
      }
    };
  });

});
