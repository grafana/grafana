import angular from 'angular';
import $ from 'jquery';

import { getTagColorsFromName } from '@grafana/ui';

import coreModule from './core_module';
import 'vendor/tagsinput/bootstrap-tagsinput.js';

function setColor(name: string, element: JQuery) {
  const { color, borderColor } = getTagColorsFromName(name);
  element.css('background-color', color);
  element.css('border-color', borderColor);
}

function tagColorFromName() {
  return {
    scope: { tagColorFromName: '=' },
    link: (scope: any, element: any) => {
      setColor(scope.tagColorFromName, element);
    },
  };
}

function bootstrapTagsinput() {
  function getItemProperty(scope: any, property: any) {
    if (!property) {
      return undefined;
    }

    if (angular.isFunction(scope.$parent[property])) {
      return scope.$parent[property];
    }

    return (item: any) => {
      return item[property];
    };
  }

  return {
    restrict: 'EA',
    scope: {
      model: '=ngModel',
      onTagsUpdated: '&',
    },
    template: '<select multiple></select>',
    replace: false,
    link: function (scope: any, element: any, attrs: any) {
      if (!angular.isArray(scope.model)) {
        scope.model = [];
      }

      const select = $('select', element);

      if (attrs.placeholder) {
        select.attr('placeholder', attrs.placeholder);
      }

      select.tagsinput({
        typeahead: {
          source: angular.isFunction(scope.$parent[attrs.typeaheadSource])
            ? scope.$parent[attrs.typeaheadSource]
            : null,
        },
        widthClass: attrs.widthClass,
        itemValue: getItemProperty(scope, attrs.itemvalue),
        itemText: getItemProperty(scope, attrs.itemtext),
        tagClass: angular.isFunction(scope.$parent[attrs.tagclass])
          ? scope.$parent[attrs.tagclass]
          : () => {
              return attrs.tagclass;
            },
      });

      select.on('itemAdded', (event: any) => {
        if (scope.model.indexOf(event.item) === -1) {
          scope.model.push(event.item);
          if (scope.onTagsUpdated) {
            scope.onTagsUpdated();
          }
        }
        const tagElement = select
          .next()
          .children('span')
          .filter(() => {
            return $(this).text() === event.item;
          });
        setColor(event.item, tagElement);
      });

      select.on('itemRemoved', (event: any) => {
        const idx = scope.model.indexOf(event.item);
        if (idx !== -1) {
          scope.model.splice(idx, 1);
          if (scope.onTagsUpdated) {
            scope.onTagsUpdated();
          }
        }
      });

      scope.$watch(
        'model',
        () => {
          if (!angular.isArray(scope.model)) {
            scope.model = [];
          }

          select.tagsinput('removeAll');

          for (let i = 0; i < scope.model.length; i++) {
            select.tagsinput('add', scope.model[i]);
          }
        },
        true
      );
    },
  };
}

coreModule.directive('tagColorFromName', tagColorFromName);
coreModule.directive('bootstrapTagsinput', bootstrapTagsinput);
