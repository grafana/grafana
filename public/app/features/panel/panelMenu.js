define([
  'angular',
  'jquery',
  'lodash',
],
function (angular, $, _) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('panelMenu', function($compile, linkSrv, contextSrv) {
      var linkTemplate =
          '<span class="panel-title drag-handle pointer">' +
            '<span class="panel-title-text drag-handle">{{panel.title | interpolateTemplateVars:this}}</span>' +
            '<span class="panel-links-icon"></span>' +
            '<span class="panel-time-info" ng-show="panelMeta.timeInfo"><i class="fa fa-clock-o"></i> {{panelMeta.timeInfo}}</span>' +
          '</span>';

      function createMenuTemplate($scope) {
        var template = '<div class="panel-menu small">';

        if ($scope.dashboardMeta.canEdit && contextSrv.isEditor) {
          template += '<div class="panel-menu-inner">';
          template += '<div class="panel-menu-row">';
          template += '<a class="panel-menu-icon pull-left" ng-click="updateColumnSpan(-1)"><i class="fa fa-minus"></i></a>';
          template += '<a class="panel-menu-icon pull-left" ng-click="updateColumnSpan(1)"><i class="fa fa-plus"></i></a>';
          template += '<a class="panel-menu-icon pull-right" ng-click="removePanel(panel)"><i class="fa fa-remove"></i></a>';
          template += '<div class="clearfix"></div>';
          template += '</div>';
        }

        template += '<div class="panel-menu-row">';
        template += '<a class="panel-menu-link" gf-dropdown="extendedMenu"><i class="fa fa-bars"></i></a>';

        _.each($scope.panelMeta.menu, function(item) {
          // skip edit actions if not editor
          if (item.role === 'Editor' && (!contextSrv.isEditor || !$scope.dashboardMeta.canEdit)) {
            return;
          }

          template += '<a class="panel-menu-link" ';
          if (item.click) { template += ' ng-click="' + item.click + '"'; }
          if (item.editorLink) { template += ' dash-editor-link="' + item.editorLink + '"'; }
          template += '>';
          template += item.text + '</a>';
        });

        template += '</div>';
        template += '</div>';
        template += '</div>';
        return template;
      }

      function getExtendedMenu($scope) {
        var menu = angular.copy($scope.panelMeta.extendedMenu);

        if ($scope.panel.links) {
          _.each($scope.panel.links, function(link) {
            var info = linkSrv.getPanelLinkAnchorInfo(link);
            menu.push({text: info.title, href: info.href, target: info.target });
          });
        }

        return menu;
      }

      return {
        restrict: 'A',
        link: function($scope, elem) {
          var $link = $(linkTemplate);
          var $panelContainer = elem.parents(".panel-container");
          var menuScope = null;
          var timeout = null;
          var $menu = null;

          elem.append($link);

          $scope.$watchCollection('panel.links', function(newValue) {
            var showIcon = (newValue ? newValue.length > 0 : false) && $scope.panel.title !== '';
            $link.toggleClass('has-panel-links', showIcon);
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
              if ($menu.is(':hover') || $scope.dashboard.$$panelDragging) {
                dismiss(2200);
                return;
              }
            }

            if (menuScope) {
              $menu.unbind();
              $menu.remove();
              menuScope.$destroy();
              menuScope = null;
              $menu = null;
              $panelContainer.removeClass('panel-highlight');
            }
          }

          var showMenu = function(e) {
            // if menu item is clicked and menu was just removed from dom ignore this event
            if (!$.contains(document, e.target)) {
              return;
            }

            if ($menu) {
              dismiss();
              return;
            }

            var menuTemplate = createMenuTemplate($scope);
            $menu = $(menuTemplate);
            $menu.mouseleave(function() {
              dismiss(1000);
            });

            menuScope = $scope.$new();
            menuScope.extendedMenu = getExtendedMenu($scope);
            menuScope.dismiss = function() {
              dismiss(null, true);
            };

            $(".panel-container").removeClass('panel-highlight');
            $panelContainer.toggleClass('panel-highlight');

            $('.panel-menu').remove();

            elem.append($menu);

            $scope.$apply(function() {
              $compile($menu.contents())(menuScope);

              var menuWidth =  $menu[0].offsetWidth;
              var menuHeight =  $menu[0].offsetHeight;

              var windowWidth = $(window).width();
              var panelLeftPos = $(elem).offset().left;
              var panelWidth = $(elem).width();

              var menuLeftPos = (panelWidth / 2) - (menuWidth/2);
              var stickingOut = panelLeftPos + menuLeftPos + menuWidth - windowWidth;
              if (stickingOut > 0) {
                menuLeftPos -= stickingOut + 10;
              }
              if (panelLeftPos + menuLeftPos < 0) {
                menuLeftPos = 0;
              }

              $menu.css({'left': menuLeftPos, top: -menuHeight});
            });

            dismiss(2200);
          };

          elem.click(showMenu);
          $compile(elem.contents())($scope);
        }
      };
    });
});
