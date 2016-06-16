///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import store from 'app/core/store';
import _ from 'lodash';
import angular from 'angular';
import $ from 'jquery';

import coreModule from 'app/core/core_module';
import {profiler} from 'app/core/profiler';
import appEvents from 'app/core/app_events';

export class GrafanaCtrl {

  /** @ngInject */
  constructor($scope, alertSrv, utilSrv, $rootScope, $controller, contextSrv) {

    $scope.init = function() {
      $scope.contextSrv = contextSrv;

      $rootScope.appSubUrl = config.appSubUrl;
      $scope._ = _;

      profiler.init(config, $rootScope);
      alertSrv.init();
      utilSrv.init();

      $scope.dashAlerts = alertSrv;
    };

    $scope.initDashboard = function(dashboardData, viewScope) {
      $scope.appEvent("dashboard-fetch-end", dashboardData);
      $controller('DashboardCtrl', { $scope: viewScope }).init(dashboardData);
    };

    $rootScope.onAppEvent = function(name, callback, localScope) {
      var unbind = $rootScope.$on(name, callback);
      var callerScope = this;
      if (callerScope.$id === 1 && !localScope) {
        console.log('warning rootScope onAppEvent called without localscope');
      }
      if (localScope) {
        callerScope = localScope;
      }
      callerScope.$on('$destroy', unbind);
    };

    $rootScope.appEvent = function(name, payload) {
      $rootScope.$emit(name, payload);
      appEvents.emit(name, payload);
    };

    $rootScope.colors = [
      "#7EB26D","#EAB839","#6ED0E0","#EF843C","#E24D42","#1F78C1","#BA43A9","#705DA0",
      "#508642","#CCA300","#447EBC","#C15C17","#890F02","#0A437C","#6D1F62","#584477",
      "#B7DBAB","#F4D598","#70DBED","#F9BA8F","#F29191","#82B5D8","#E5A8E2","#AEA2E0",
      "#629E51","#E5AC0E","#64B0C8","#E0752D","#BF1B00","#0A50A1","#962D82","#614D93",
      "#9AC48A","#F2C96D","#65C5DB","#F9934E","#EA6460","#5195CE","#D683CE","#806EB7",
      "#3F6833","#967302","#2F575E","#99440A","#58140C","#052B51","#511749","#3F2B5B",
      "#E0F9D7","#FCEACA","#CFFAFF","#F9E2D2","#FCE2DE","#BADFF4","#F9D9F9","#DEDAF7"
    ];

    $scope.init();
  }
}

/** @ngInject */
export function grafanaAppDirective(playlistSrv, contextSrv) {
  return {
    restrict: 'E',
    controller: GrafanaCtrl,
    link: (scope, elem) => {
      var ignoreSideMenuHide;
      var body = $('body');

      // handle sidemenu open state
      scope.$watch('contextSrv.sidemenu', newVal => {
        if (newVal !== undefined) {
          body.toggleClass('sidemenu-open', scope.contextSrv.sidemenu);
          if (!newVal) {
            contextSrv.setPinnedState(false);
          }
        }
        if (contextSrv.sidemenu) {
          ignoreSideMenuHide = true;
          setTimeout(() => {
            ignoreSideMenuHide = false;
          }, 300);
        }
      });

      scope.$watch('contextSrv.pinned', newVal => {
        if (newVal !== undefined) {
          body.toggleClass('sidemenu-pinned', newVal);
        }
      });

      // tooltip removal fix
      // manage page classes
      var pageClass;
      scope.$on("$routeChangeSuccess", function(evt, data) {
        if (pageClass) {
          body.removeClass(pageClass);
        }
        pageClass = data.$$route.pageClass;
        if (pageClass) {
          body.addClass(pageClass);
        }
        $("#tooltip, .tooltip").remove();
      });

      // handle document clicks that should hide things
      body.click(function(evt) {
        var target = $(evt.target);
        if (target.parents().length === 0) {
          return;
        }

        if (target.parents('.dash-playlist-actions').length === 0) {
          playlistSrv.stop();
        }

        // hide search
        if (body.find('.search-container').length > 0) {
          if (target.parents('.search-container').length === 0) {
            scope.$apply(function() {
              scope.appEvent('hide-dash-search');
            });
          }
        }
        // hide sidemenu
        if (!ignoreSideMenuHide && !contextSrv.pinned && body.find('.sidemenu').length > 0) {
          if (target.parents('.sidemenu').length === 0) {
            scope.$apply(function() {
              scope.contextSrv.toggleSideMenu();
            });
          }
        }

        // hide popovers
        var popover = elem.find('.popover');
        if (popover.length > 0 && target.parents('.graph-legend').length === 0) {
          popover.hide();
        }
      });
    }
  };
}

coreModule.directive('grafanaApp', grafanaAppDirective);
