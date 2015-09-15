/***************************************************************
 *
 * Author   : boguslaw.gorczyca
 * Created  : 2015-06-15
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 ****************************************************************/

/* global angular, console */

define([
    'angular'
  ],

  function (angular) {

    'use strict';

    var module = angular.module('grafana.directives');

    module.directive('ngSpinner', function($compile, $timeout) {
      return {
        restrict: 'E',
        scope : {
          spinnerShowTrigger: '=',
          spinnerState: '=',
          spinnerDelay: '@'
        },

        link: function($scope, $element) {
          var showTimer = null;

          function getDelay() {
            var delay = parseInt($scope.spinnerDelay);
            return angular.isNumber(delay) ? delay : 200;
          }

          function showElement (state) {
            if (state === true) {
              $element.css({display: ''});
              $scope.spinnerState = true;
            } else {
              $element.css({display: 'none'});
              $scope.spinnerState = false;
            }
          }

          function showSpinner() {
            if (showTimer === null) {
              showTimer = $timeout(showElement.bind(null, true), getDelay());
            }
          }

          function hideSpinner() {
            if (showTimer != null) {
              $timeout.cancel(showTimer);
            }

            showTimer = null;
            showElement(false);
          }

          showElement(false);

          $scope.$watch('spinnerShowTrigger', function (showTrigger) {
            if (showTrigger === true) {
              showSpinner();
            } else {
              hideSpinner();
            }
          });
        }
      };
    });
  });
