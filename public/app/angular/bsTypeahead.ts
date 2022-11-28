import angular from 'angular';
import $ from 'jquery';
import { isFunction } from 'lodash';

import coreModule from './core_module';

coreModule.directive('bsTypeahead', [
  '$parse',
  function ($parse: any) {
    return {
      restrict: 'A',
      require: '?ngModel',
      link: function postLink(scope: any, element: any, attrs: any, controller: any) {
        let getter = $parse(attrs.bsTypeahead),
          value = getter(scope);
        scope.$watch(attrs.bsTypeahead, function (newValue: any, oldValue: any) {
          if (newValue !== oldValue) {
            value = newValue;
          }
        });
        element.attr('data-provide', 'typeahead');
        element.typeahead({
          source: function () {
            return angular.isFunction(value) ? value.apply(null, arguments) : value;
          },
          minLength: attrs.minLength || 1,
          items: attrs.item,
          updater: function (value: any) {
            if (controller) {
              scope.$apply(function () {
                controller.$setViewValue(value);
              });
            }
            scope.$emit('typeahead-updated', value);
            return value;
          },
        });
        const typeahead = element.data('typeahead');
        typeahead.lookup = function () {
          let items;
          this.query = this.$element.val() || '';
          if (this.query.length < this.options.minLength) {
            return this.shown ? this.hide() : this;
          }
          items = isFunction(this.source) ? this.source(this.query, $.proxy(this.process, this)) : this.source;
          return items ? this.process(items) : this;
        };
        if (!!attrs.matchAll) {
          typeahead.matcher = function () {
            return true;
          };
        }
        if (attrs.minLength === '0') {
          setTimeout(function () {
            element.on('focus', function () {
              element.val().length === 0 && setTimeout(element.typeahead.bind(element, 'lookup'), 200);
            });
          });
        }
      },
    };
  },
]);
