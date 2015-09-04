/*****************************************************************
 *
 * Author   : Bogusław Gorczyca
 * Created  : 2015-09-03 16:08
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 *****************************************************************/

/* global angular, console */

define([
    'angular'
  ],

  function (angular) {

    'use strict';

    var module = angular.module('grafana.directives');

    module.directive('ngFocusMe', function($timeout) {

      return {

        restrict: 'A',

        scope: {
          focusTrigger : '=ngFocusMe'
        },

        link : function ($scope, $element) {
          $scope.$watch('focusTrigger', function (value) {
            if (value === true) {
              $timeout(function(){
                $element[0].focus();
                $scope.focusTrigger = false;
              }, 0);
            }
          });
        }
      };
    });
  });
