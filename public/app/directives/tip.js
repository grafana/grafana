define([
  'angular',
  'kbn'
],
function (angular, kbn) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('tip', function($compile) {
      return {
        restrict: 'E',
        link: function(scope, elem, attrs) {
          var _t = '<i class="grafana-tip fa fa-'+(attrs.icon||'question-circle')+'" bs-tooltip="\''+
            kbn.addslashes(elem.text())+'\'"></i>';
          elem.replaceWith($compile(angular.element(_t))(scope));
        }
      };
    });

  angular
    .module('grafana.directives')
    .directive('watchChange', function() {
      return {
        scope: { onchange: '&watchChange' },
        link: function(scope, element) {
          element.on('input', function() {
            scope.$apply(function () {
              scope.onchange({ inputValue: element.val() });
            });
          });
        }
      };
    });

  angular
    .module('grafana.directives')
    .directive('editorOptBool', function($compile) {
      return {
        restrict: 'E',
        link: function(scope, elem, attrs) {
          var ngchange = attrs.change ? (' ng-change="' + attrs.change + '"') : '';
          var tip = attrs.tip ? (' <tip>' + attrs.tip + '</tip>') : '';
          var showIf = attrs.showIf ? (' ng-show="' + attrs.showIf + '" ') : '';

          var template = '<div class="editor-option text-center"' + showIf + '>' +
                         ' <label for="' + attrs.model + '" class="small">' +
                           attrs.text + tip + '</label>' +
                          '<input class="cr1" id="' + attrs.model + '" type="checkbox" ' +
                          '       ng-model="' + attrs.model + '"' + ngchange +
                          '       ng-checked="' + attrs.model + '"></input>' +
                          ' <label for="' + attrs.model + '" class="cr1"></label>';
          elem.replaceWith($compile(angular.element(template))(scope));
        }
      };
    });

  angular
    .module('grafana.directives')
    .directive('editorCheckbox', function($compile, $interpolate) {
      return {
        restrict: 'E',
        link: function(scope, elem, attrs) {
          var text = $interpolate(attrs.text)(scope);
          var ngchange = attrs.change ? (' ng-change="' + attrs.change + '"') : '';
          var tip = attrs.tip ? (' <tip>' + attrs.tip + '</tip>') : '';
          var label = '<label for="' + scope.$id + attrs.model + '" class="checkbox-label">' +
                           text + tip + '</label>';

          var template = '<input class="cr1" id="' + scope.$id + attrs.model + '" type="checkbox" ' +
                          '       ng-model="' + attrs.model + '"' + ngchange +
                          '       ng-checked="' + attrs.model + '"></input>' +
                          ' <label for="' + scope.$id + attrs.model + '" class="cr1"></label>';

          template = label + template;
          elem.replaceWith($compile(angular.element(template))(scope));
        }
      };
    });

  angular
    .module('grafana.directives')
    .directive('tagColorFromName', function() {

    function djb2(str) {
      var hash = 5381;
      for (var i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
      }
      return hash;
    }

    return {
      scope: { tagColorFromName: "=" },
      link: function (scope, element) {
        var hash = djb2(scope.tagColorFromName.toLowerCase());
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

        element.css("background-color", color);
        element.css("border-color", borderColor);
      }
    };
  });});
