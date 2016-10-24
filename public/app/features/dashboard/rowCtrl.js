// define([
//   'angular',
//   'lodash',
//   'app/core/config'
// ],
// function (angular, _, config) {
//   'use strict';
//
//   var module = angular.module('grafana.controllers');
//
//   module.controller('RowCtrl', function($scope, $rootScope, $timeout) {
//
//     $scope.moveRow = function(direction) {
//       var rowsList = $scope.dashboard.rows;
//       var rowIndex = _.indexOf(rowsList, $scope.row);
//       var newIndex = rowIndex;
//       switch(direction) {
//         case 'up': {
//           newIndex = rowIndex - 1;
//           break;
//         }
//         case 'down': {
//           newIndex = rowIndex + 1;
//           break;
//         }
//         case 'top': {
//           newIndex = 0;
//           break;
//         }
//         case 'bottom': {
//           newIndex = rowsList.length - 1;
//           break;
//         }
//         default: {
//           newIndex = rowIndex;
//         }
//       }
//       if (newIndex >= 0 && newIndex <= (rowsList.length - 1)) {
//         _.move(rowsList, rowIndex, newIndex);
//       }
//     };
//
//     $scope.setHeight = function(height) {
//       $scope.row.height = height;
//       $scope.$broadcast('render');
//     };
//
//     $scope.init();
//   });
//
// });
