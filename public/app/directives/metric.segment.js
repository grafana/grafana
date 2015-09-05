define([
  'angular',
  'app',
  'lodash',
  'jquery',
],
function (angular, app, _, $) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('metricSegment', function($compile, $sce) {
      var inputTemplate = '<input type="text" data-provide="typeahead" ' +
                            ' class="tight-form-clear-input input-medium"' +
                            ' spellcheck="false" style="display:none"></input>';

      var buttonTemplate = '<a class="tight-form-item" ng-class="segment.cssClass" ' +
        'tabindex="1" give-focus="segment.focus" ng-bind-html="segment.html"></a>';

      return {
        scope: {
          segment: "=",
          disableCustom: "=",
          getAltSegments: "&",
          onValueChanged: "&",
        },

        link: function($scope, elem) {
          var $input = $(inputTemplate);
          var $button = $(buttonTemplate);
          var segment = $scope.segment;
          var options = null;
          var cancelBlur = null;

          $input.appendTo(elem);
          $button.appendTo(elem);

          $scope.updateVariableValue = function(value) {
            if (value === '' || segment.value === value) {
              return;
            }

            $scope.$apply(function() {
              var selected = _.findWhere($scope.altSegments, { value: value });
              if (selected) {
                segment.value = selected.value;
                segment.html = selected.html;
                segment.fake = false;
                segment.expandable = selected.expandable;
              }
              else if ($scope.disableCustom === false) {
                segment.value = value;
                segment.html = $sce.trustAsHtml(value);
                segment.expandable = true;
                segment.fake = false;
              }

              $scope.onValueChanged();
            });
          };

          $scope.switchToLink = function(now) {
            if (now === true || cancelBlur) {
              clearTimeout(cancelBlur);
              cancelBlur = null;
              $input.hide();
              $button.show();
              $scope.updateVariableValue($input.val());
            }
            else {
              // need to have long delay because the blur
              // happens long before the click event on the typeahead options
              cancelBlur = setTimeout($scope.switchToLink, 100);
            }
          };

          $scope.source = function(query, callback) {
            if (options) { return options; }

            $scope.$apply(function() {
              $scope.getAltSegments().then(function(altSegments) {
                $scope.altSegments = altSegments;
                options = _.map($scope.altSegments, function(alt) { return alt.value; });

                // add custom values
                if ($scope.disableCustom === false) {
                  if (!segment.fake && _.indexOf(options, segment.value) === -1) {
                    options.unshift(segment.value);
                  }
                }

                callback(options);
              });
            });
          };

          $scope.updater = function(value) {
            if (value === segment.value) {
              clearTimeout(cancelBlur);
              $input.focus();
              return value;
            }

            $input.val(value);
            $scope.switchToLink(true);

            return value;
          };

          $scope.matcher = function(item) {
            var str = this.query;
            if (str[0] === '/') { str = str.substring(1); }
            if (str[str.length - 1] === '/') { str = str.substring(0, str.length-1); }
            try {
              return item.toLowerCase().match(str);
            } catch(e) {
              return false;
            }
          };

          $input.attr('data-provide', 'typeahead');
          $input.typeahead({ source: $scope.source, minLength: 0, items: 10000, updater: $scope.updater, matcher: $scope.matcher });

          var typeahead = $input.data('typeahead');
          typeahead.lookup = function () {
            this.query = this.$element.val() || '';
            var items = this.source(this.query, $.proxy(this.process, this));
            return items ? this.process(items) : items;
          };

          $button.keydown(function(evt) {
            // trigger typeahead on down arrow or enter key
            if (evt.keyCode === 40 || evt.keyCode === 13) {
              $button.click();
            }
          });

          $button.click(function() {
            options = null;
            $input.css('width', ($button.width() + 16) + 'px');

            $button.hide();
            $input.show();
            $input.focus();

            var typeahead = $input.data('typeahead');
            if (typeahead) {
              $input.val('');
              typeahead.lookup();
            }
          });

          $input.blur($scope.switchToLink);

          $compile(elem.contents())($scope);
        }
      };
    });

  angular
    .module('grafana.directives')
    .directive('metricSegmentModel', function(uiSegmentSrv, $q) {
      return {
        template: '<metric-segment segment="segment" get-alt-segments="getOptions()" on-value-changed="onSegmentChange()" disable-custom="true"></metric-segment>',
        restrict: 'E',
        scope: {
          property: "=",
          options: "=",
          onChange: "&",
        },
        link: {
          pre: function postLink($scope, elem) {

            $scope.valueToSegment = function(value) {
              var option = _.findWhere($scope.options, {value: value});
              if (option) {
                return uiSegmentSrv.newSegment({value: option.text});
              } else {
                return uiSegmentSrv.newSegment({value: value});
              }
            };

            $scope.getOptions = function() {
              var optionSegments = _.map($scope.options, function(option) {
                return uiSegmentSrv.newSegment({value: option.text});
              });
              return $q.when(optionSegments);
            };

            $scope.onSegmentChange = function() {
              var option = _.findWhere($scope.options, {text: $scope.segment.value});
              if (option && option.value !== $scope.property) {
                $scope.property = option.value;
                $scope.onChange();
              }
            };

            $scope.segment = $scope.valueToSegment($scope.property);
          }
        }
      };
    });
});
