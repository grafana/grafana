/*****************************************************************
 *
 * Author   : Bogusław Gorczyca
 * Created  : 2015-08-28 15:11
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 *****************************************************************/

define([
    'angular',
    'lodash',
    'jquery'
  ],

  function (angular, _, $) {

    'use strict';

    var module = angular.module('grafana.directives');

    module.directive('ngTypeAhead', function($timeout) {

      var TAB_CODE = 9,
          ENTER_CODE = 13,
          ESC_CODE = 27,
          SPACE_CODE = 32,
          PAGE_UP_CODE = 33,
          PAGE_DOWN_CODE = 34,
          END_CODE = 35,
          HOME_CODE = 36,
          UP_ARROW_CODE = 38,
          DOWN_ARROW_CODE = 40;

      return {
        restrict: 'E',
        scope : {
          typeAheadName: '@',
          inputElement: '@',
          contentElement: '@',
          onEsc: '@',
          typeAheadPosition: '='
        },

        link: function($scope, $element) {
          var input = angular.element($scope.inputElement),
              content = angular.element($scope.contentElement),
              keysMap = Object.create(null);

          function doNothing(event) {
            event.preventDefault();
            event.stopPropagation();
            return false;
          }

          function handleEnter(event) {
            event.preventDefault();
            event.target.click();
          }

          function handleEsc(event) {
            if ($scope.onEsc != null) {
              $scope.$parent.$eval($scope.onEsc);
            }
            event.preventDefault();
            event.stopPropagation();
            return false;
          }

          keysMap[TAB_CODE] = doNothing;
          keysMap[ENTER_CODE] = handleEnter;
          keysMap[ESC_CODE] = handleEsc;
          keysMap[SPACE_CODE] = null;
          keysMap[PAGE_UP_CODE] = true;
          keysMap[PAGE_DOWN_CODE] = true;
          keysMap[END_CODE] = true;
          keysMap[HOME_CODE] = true;
          keysMap[UP_ARROW_CODE] = true;
          keysMap[DOWN_ARROW_CODE] = true;

          $element[0].addEventListener('keydown', function(event) {
            if (event.keyCode === TAB_CODE) {
              keysMap[event.keyCode](event);
            }
          }, true);

          $element.bind("keydown keypress", function(event) {
            var source = angular.element(event.target || event.srcElement),
                isInputEvent = (source[0] === input[0]),
                firstContentElement;

            if (event.keyCode === ESC_CODE) {
              keysMap[ESC_CODE](event);
            } else {
              if (isInputEvent === true) {
                if (keysMap[event.keyCode] != null) {
                  event.preventDefault();
                  firstContentElement = content[0].querySelector('[tabindex]');
                  if (firstContentElement != null) {
                    firstContentElement.focus();
                  }
                }
              } else {
                if (event.keyCode === ENTER_CODE) {
                  keysMap[event.keyCode](event);
                } else {
                  if (keysMap[event.keyCode] == null) {
                    event.preventDefault();
                    input.focus();
                  }
                }
              }
            }
          });

          $timeout(function() {
            $scope.$watch('typeAheadPosition', function(position) {
              var positionPointerName = '[' + $scope.typeAheadName + '="' + position + '"]',
                  positionPointer = $(positionPointerName);

              if (positionPointer != null) {
                $timeout(function() {
                  var positionPointerOffset,
                      left,
                      top;

                  positionPointerOffset = positionPointer.offset();
                  if (positionPointerOffset != null) {
                    left = positionPointerOffset.left;
                    top = positionPointerOffset.top;
                    $($element).offset({top : top, left : left});
                  }
                }, 0);
              }
            });
          }, 0);
        }
      };
    });
  });
