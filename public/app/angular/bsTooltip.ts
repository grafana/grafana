import angular from 'angular';
import $ from 'jquery';

import coreModule from './core_module';

coreModule.directive('bsTooltip', [
  '$parse',
  '$compile',
  function ($parse: any, $compile: any) {
    return {
      restrict: 'A',
      scope: true,
      link: function postLink(scope: any, element: any, attrs: any) {
        let getter = $parse(attrs.bsTooltip),
          value = getter(scope);
        scope.$watch(attrs.bsTooltip, function (newValue: any, oldValue: any) {
          if (newValue !== oldValue) {
            value = newValue;
          }
        });
        // Grafana change, always hide other tooltips
        if (true) {
          element.on('show', function (ev: any) {
            $('.tooltip.in').each(function () {
              const $this = $(this),
                tooltip = $this.data('tooltip');
              if (tooltip && !tooltip.$element.is(element)) {
                $this.tooltip('hide');
              }
            });
          });
        }
        element.tooltip({
          title: function () {
            return angular.isFunction(value) ? value.apply(null, arguments) : value;
          },
          html: true,
          container: 'body', // Grafana change
        });
        const tooltip = element.data('tooltip');
        tooltip.show = function () {
          const r = $.fn.tooltip.Constructor.prototype.show.apply(this, arguments);
          this.tip().data('tooltip', this);
          return r;
        };
        scope._tooltip = function (event: any) {
          element.tooltip(event);
        };
        scope.hide = function () {
          element.tooltip('hide');
        };
        scope.show = function () {
          element.tooltip('show');
        };
        scope.dismiss = scope.hide;
      },
    };
  },
]);
