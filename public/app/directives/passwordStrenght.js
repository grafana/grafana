define([
  'angular',
],
function (angular) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('passwordStrength', function() {
      var template = '<div class="password-strength small" ng-if="!loginMode" ng-class="strengthClass">' +
                            '<em>{{strengthText}}</em>' +
                          '</div>';
      return {
        template: template,
        scope: {
          password: "=",
        },
        link: function($scope) {

          $scope.strengthClass = '';

          function passwordChanged(newValue) {
            if (!newValue) {
              $scope.strengthText = "";
              $scope.strengthClass = "hidden";
              return;
            }
            if (newValue.length < 4) {
              $scope.strengthText = "strength: weak sauce.";
              $scope.strengthClass = "password-strength-bad";
              return;
            }
            if (newValue.length <= 8) {
              $scope.strengthText = "strength: you can do better.";
              $scope.strengthClass = "password-strength-ok";
              return;
            }

            $scope.strengthText = "strength: strong like a bull.";
            $scope.strengthClass = "password-strength-good";
          }

          $scope.$watch("password", passwordChanged);
        }
      };
    });
});
