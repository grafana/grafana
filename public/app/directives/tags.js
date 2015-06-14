define([
  'angular',
  'jquery',
  'bootstrap-tagsinput'
],
function (angular, $) {
  'use strict';

  function djb2(str) {
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
    }
    return hash;
  }

  function setColor(name, element) {
    var hash = djb2(name.toLowerCase());
    var colors = [
      "#E24D42","#1F78C1","#BA43A9","#705DA0","#466803",
      "#508642","#447EBC","#C15C17","#890F02","#757575",
      "#0A437C","#6D1F62","#584477","#629E51","#2F4F4F",
      "#BF1B00","#806EB7","#8a2eb8", "#699e00","#000000",
      "#3F6833","#2F575E","#99440A","#E0752D","#0E4AB4",
      "#58140C","#052B51","#511749","#3F2B5B",
    ];
    var borderColors = [
      "#FF7368","#459EE7","#E069CF","#9683C6","#6C8E29",
      "#76AC68","#6AA4E2","#E7823D","#AF3528","#9B9B9B",
      "#3069A2","#934588","#7E6A9D","#88C477","#557575",
      "#E54126","#A694DD","#B054DE", "#8FC426","#262626",
      "#658E59","#557D84","#BF6A30","#FF9B53","#3470DA",
      "#7E3A32","#2B5177","#773D6F","#655181",
    ];

    var color = colors[Math.abs(hash % colors.length)];
    var borderColor = borderColors[Math.abs(hash % borderColors.length)];

    // fixed color for raintank
    if (hash === -657812483) {
      color = "#13B2D4";
      borderColor = "#3CD7F9";
    }

    element.css("background-color", color);
    element.css("border-color", borderColor);
  }

  angular
  .module('grafana.directives')
  .directive('tagColorFromName', function() {
    return {
      scope: { tagColorFromName: "=" },
      link: function (scope, element) {
        setColor(scope.tagColorFromName, element);
      }
    };
  });

  angular
  .module('grafana.directives')
  .directive('bootstrapTagsinput', function() {

    function getItemProperty(scope, property) {
      if (!property) {
        return undefined;
      }

      if (angular.isFunction(scope.$parent[property])) {
        return scope.$parent[property];
      }

      return function(item) {
        return item[property];
      };
    }

    return {
      restrict: 'EA',
      scope: {
        model: '=ngModel',
        onTagsUpdated: "&",
      },
      template: '<select multiple></select>',
      replace: false,
      link: function(scope, element, attrs) {

        if (!angular.isArray(scope.model)) {
          scope.model = [];
        }

        var select = $('select', element);

        if (attrs.placeholder) {
          select.attr('placeholder', attrs.placeholder);
        }

        select.tagsinput({
          typeahead: {
            source: angular.isFunction(scope.$parent[attrs.typeaheadSource]) ? scope.$parent[attrs.typeaheadSource] : null
          },
          itemValue: getItemProperty(scope, attrs.itemvalue),
          itemText : getItemProperty(scope, attrs.itemtext),
          tagClass : angular.isFunction(scope.$parent[attrs.tagclass]) ?
            scope.$parent[attrs.tagclass] : function() { return attrs.tagclass; }
        });

        select.on('itemAdded', function(event) {
          if (scope.model.indexOf(event.item) === -1) {
            scope.model.push(event.item);
            if (scope.onTagsUpdated) {
              scope.onTagsUpdated();
            }
          }
          var tagElement = select.next().children("span").filter(function() { return $(this).text() === event.item; });
          setColor(event.item, tagElement);
        });

        select.on('itemRemoved', function(event) {
          var idx = scope.model.indexOf(event.item);
          if (idx !== -1) {
            scope.model.splice(idx, 1);
            if (scope.onTagsUpdated) {
              scope.onTagsUpdated();
            }
          }
        });

        scope.$watch("model", function() {
          if (!angular.isArray(scope.model)) {
            scope.model = [];
          }

          select.tagsinput('removeAll');

          for (var i = 0; i < scope.model.length; i++) {
            select.tagsinput('add', scope.model[i]);
          }

        }, true);
      }
    };
  });

});
