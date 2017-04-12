define([
  'angular',
  'jquery',
  'lodash',
],
function (angular, $, _) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('panelMenu', function($compile, linkSrv) {
      var linkTemplate =
          '<span class="panel-title drag-handle pointer">' +
            '<span class="panel-title-text drag-handle">{{panel.title | interpolateTemplateVars:this}}</span>' +
            '<span class="panel-links-btn"><i class="fa fa-external-link"></i></span>' +
            '<span class="panel-time-info" ng-show="panelMeta.timeInfo"><i class="fa fa-clock-o"></i> {{panelMeta.timeInfo}}</span>' +
          '</span>';

      function createExternalLinkMenu($scope) {
        var template = '<div class="panel-menu small">';
        template += '<div class="panel-menu-row">';

        if ($scope.panel.links) {
          _.each($scope.panel.links, function(link) {
            var info = linkSrv.getPanelLinkAnchorInfo(link, $scope.panel.scopedVars);
            template += '<a class="panel-menu-link" href="' + info.href + '" target="' + info.target + '">' + info.title + '</a>';
          });
        }
        return template;
      }
      function createMenuTemplate($scope) {
        var template = '<div class="pull-right panel-right-menu" ng-show="!panelMeta.loading">';
        _.each($scope.panelMeta.menu, function (item) {
          if (item.role === 'Editor' && !$scope.dashboardMeta.canEdit) {
            return;
          }
          template += '<span class="panel-right-menu-item"';
          if (item.show) {
            template += ' ng-if="' + item.show + '"';
          }
          template += ' ng-click="' + item.click + '" bs-tooltip="' + "'" + item.text + "'" + '">';
          template += '<i class="fa ' + item.icon + '"></i>';
          template += '</span>';
        });

        template += '<div class="dropdown pull-right panel-right-menu-item">';
        template += '<a class="pointer" ng-click="hideTooltip($event)" data-placement="bottom" data-toggle="dropdown"><i class="fa fa-bars"></i></a>';
        template += '<ul class="dropdown-menu">';
        _.each($scope.panelMeta.extendedMenu, function (item) {
          if (item.role === 'Editor' && !$scope.dashboardMeta.canEdit) {
            return;
          }
          template += '<li><a class="pointer"';
          if (item.click) { template += ' ng-click="'+ item.click +'"'; }
          template += '>' + item.text + '</a></li>'
        });
        template += '</ul>';
        template += '</div>';
        template += '</div>';
        return template;
      }

      function getExtendedMenu($scope) {
        var menu = angular.copy($scope.panelMeta.extendedMenu);
        return menu;
      }

      return {
        restrict: 'A',
        link: function($scope, elem) {
          var $link = $(linkTemplate);
          var $panelLinksBtn = $link.find(".panel-links-btn");
          var $panelContainer = elem.parents(".panel-container");
          var menuScope = null;
          var timeout = null;
          var $menu = null;

          elem.append($link);

          $scope.$watchCollection('panel.links', function(newValue) {
            var showIcon = (newValue ? newValue.length > 0 : false) && $scope.panel.title !== '';
            $panelLinksBtn.toggle(showIcon);
          });

          elem.append($(createMenuTemplate($scope)));

          $compile(elem.contents())($scope);
        }
      };
    });
});
