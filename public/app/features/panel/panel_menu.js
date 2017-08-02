define([
  'angular',
  'jquery',
  'lodash',
  'tether',
],
function (angular, $, _, Tether) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('panelMenu', function($compile, linkSrv) {
      var linkTemplate =
          '<span class="panel-title drag-handle pointer">' +
            '<span class="panel-title-text drag-handle">{{ctrl.panel.title | interpolateTemplateVars:this}}</span>' +
            '<span class="panel-links-btn"><i class="fa fa-external-link"></i></span>' +
            '<span class="panel-time-info" ng-show="ctrl.timeInfo"><i class="fa fa-clock-o"></i> {{ctrl.timeInfo}}</span>' +
          '</span>';

      function createExternalLinkMenu(ctrl) {
        var template = '<div class="panel-menu small">';
        template += '<div class="panel-menu-row">';

        if (ctrl.panel.links) {
          _.each(ctrl.panel.links, function(link) {
            var info = linkSrv.getPanelLinkAnchorInfo(link, ctrl.panel.scopedVars);
            template += '<a class="panel-menu-link" href="' + info.href + '" target="' + info.target + '">' + info.title + '</a>';
          });
        }
        return template;
      }

      function createMenuTemplate(ctrl) {
        // debugger
        var template = '<div class="panel-right-menu" ng-show="!ctrl.loading">';
        _.each(ctrl.getMenu(), function (item) {
          if (item.role === 'Editor' && !ctrl.dashboard.meta.canEdit) {
            return;
          }
          template += '<span class="';
          var className = 'panel-right-menu-item';
          if (item.hover) {
            className += ' ' + item.hover;
          }
          template += className + '"';
          template += ' ng-click="' + item.click + '" bs-tooltip="' + "'" + item.text + "'" + '" data-container="body">';
          template += '<i class="fa ' + item.icon + '"></i>';
          template += '</span>';
        });

        template += '<div class="dropdown pull-right panel-right-menu-item">';
        template += '<a class="pointer" ng-click="hideTooltip($event)" data-placement="bottom" data-toggle="dropdown"><i class="fa fa-bars"></i></a>';
        template += '<ul class="dropdown-menu">';
        _.each(ctrl.getExtendedMenu(), function (item) {
          if (item.role === 'Editor' && !ctrl.dashboard.meta.canEdit) {
            return;
          }
          template += '<li><a class="pointer"';
          if (item.click) { template += ' ng-click="'+ item.click +'"'; }
          template += '>' + item.text + '</a></li>';
        });
        template += '</ul>';
        template += '</div>';
        template += '</div>';
        return template;
      }

      function getExtendedMenu(ctrl) {
        return ctrl.getExtendedMenu();
      }

      return {
        restrict: 'A',
        link: function($scope, elem) {
          var $link = $(linkTemplate);
          var $panelLinksBtn = $link.find(".panel-links-btn");
          var $panelContainer = elem.parents(".panel-container");
          var menuScope = null;
          var ctrl = $scope.ctrl;
          var timeout = null;
          var $menu = null;
          var teather;

          elem.append($link);

          $scope.$watchCollection('ctrl.panel.links', function(newValue) {
            var showIcon = (newValue ? newValue.length > 0 : false) && ctrl.panel.title !== '';
            $panelLinksBtn.toggle(showIcon);
          });

          function dismiss(time, force) {
            clearTimeout(timeout);
            timeout = null;

            if (time) {
              timeout = setTimeout(dismiss, time);
              return;
            }

            // if hovering or draging pospone close
            if (force !== true) {
              if ($menu.is(':hover') || $scope.ctrl.dashboard.$$panelDragging) {
                dismiss(2200);
                return;
              }
            }

            if (menuScope) {
              teather.destroy();
              $menu.unbind();
              $menu.remove();
              menuScope.$destroy();
              menuScope = null;
              $menu = null;
              $panelContainer.removeClass('panel-highlight');
            }
          }

          elem.append(createMenuTemplate(ctrl));
          $compile(elem.contents())($scope);
        }
      };
    });
});
