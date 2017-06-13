define([
  'angular',
  'jquery',
],
function (angular, $) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('panelMenu', function($compile) {
      var linkTemplate =
          '<span class="panel-title drag-handle pointer">' +
            '<span class="icon-gf panel-alert-icon"></span>' +
            '<span class="panel-title-text drag-handle">{{ctrl.panel.title | interpolateTemplateVars:this}}</span>' +
            '<span class="panel-time-info" ng-show="ctrl.timeInfo"><i class="fa fa-clock-o"></i> {{ctrl.timeInfo}}</span>' +
          '</span>';

      return {
        restrict: 'A',
        link: function($scope, elem) {
          var $link = $(linkTemplate);
          //var menuScope = null;
          //var timeout = null;
          //var $menu = null;
          //var teather;

          elem.append($link);

          // function dismiss(time, force) {
          //   clearTimeout(timeout);
          //   timeout = null;
          //
          //   if (time) {
          //     timeout = setTimeout(dismiss, time);
          //     return;
          //   }
          //
          //   // if hovering or draging pospone close
          //   if (force !== true) {
          //     if ($menu.is(':hover') || $scope.ctrl.dashboard.$$panelDragging) {
          //       dismiss(2200);
          //       return;
          //     }
          //   }
          //
          //   if (menuScope) {
          //     teather.destroy();
          //     $menu.unbind();
          //     $menu.remove();
          //     menuScope.$destroy();
          //     menuScope = null;
          //     $menu = null;
          //     $panelContainer.removeClass('panel-highlight');
          //   }
          // }

          var showMenu = function() {
            // // if menu item is clicked and menu was just removed from dom ignore this event
            // if (!$.contains(document, e.target)) {
            //   return;
            // }
            //
            // if ($menu) {
            //   dismiss();
            //   return;
            // }
            //
            // var menuTemplate;
            // menuTemplate = createMenuTemplate(ctrl);
            //
            // $menu = $(menuTemplate);
            // $menu.mouseleave(function() {
            //   dismiss(1000);
            // });
            //
            // menuScope = $scope.$new();
            // menuScope.extendedMenu = getExtendedMenu(ctrl);
            // menuScope.dismiss = function() {
            //   dismiss(null, true);
            // };
            //
            // $(".panel-container").removeClass('panel-highlight');
            // $panelContainer.toggleClass('panel-highlight');
            //
            // $('.panel-menu').remove();
            //
            // elem.append($menu);
            //
            // $scope.$apply(function() {
            //   $compile($menu.contents())(menuScope);
            //
            //   teather = new Tether({
            //     element: $menu,
            //     target: $panelContainer,
            //     attachment: 'bottom center',
            //     targetAttachment: 'top center',
            //     constraints: [
            //       {
            //         to: 'window',
            //         attachment: 'together',
            //         pin: true
            //       }
            //     ]
            //   });
            // });
            //
            // dismiss(2200);
          };

          elem.click(showMenu);
          $compile(elem.contents())($scope);
        }
      };
    });
});
