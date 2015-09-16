/*****************************************************************
 *
 * Author   : Bogusław Gorczyca
 * Created  : 2015-09-03 17:46
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 *****************************************************************/

define([
    'angular'
  ],

  function (angular) {

    'use strict';

    var module = angular.module('grafana.directives');

    var TAB_CODE = 9,
        ENTER_CODE = 13,
        SPACE_CODE = 32,
        UP_ARROW_CODE = 38,
        DOWN_ARROW_CODE = 40;

    function keyClick(keyCode) {
      return function () {
        return {

          restrict: 'A',

          link: function ($scope, $element) {

            function keyboardHandler (event) {
              if (event.keyCode === keyCode) {
                $element.click();
              }
            }

            $element.on('keydown', keyboardHandler);

            $scope.$on('$destroy', function() {
              $element.off('keydown', keyboardHandler);
            });
          }
        };
      };
    }

    module.directive('ngTabClick', keyClick(TAB_CODE));
    module.directive('ngEnterClick', keyClick(ENTER_CODE));
    module.directive('ngSpaceClick', keyClick(SPACE_CODE));
    module.directive('ngUpArrowClick', keyClick(UP_ARROW_CODE));
    module.directive('ngDownArrowClick', keyClick(DOWN_ARROW_CODE));
  });
