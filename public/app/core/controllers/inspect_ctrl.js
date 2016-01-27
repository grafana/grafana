define([
  'angular',
  'lodash',
  'jquery',
  '../core_module',
],
function (angular, _, $, coreModule) {
  'use strict';

  coreModule.default.controller('InspectCtrl', function($scope) {
    var model = $scope.inspector;

    function getParametersFromQueryString(queryString) {
      var result = [];
      var parameters = queryString.split("&");
      for (var i = 0; i < parameters.length; i++) {
        var keyValue = parameters[i].split("=");
        if (keyValue[1].length > 0) {
          result.push({ key: keyValue[0], value: window.unescape(keyValue[1]) });
        }
      }
      return result;
    }

    $scope.init = function () {
      $scope.editor = { index: 0 };

      if (!model.error)  {
        return;
      }

      if (_.isString(model.error.data)) {
        $scope.response = $("<div>" + model.error.data + "</div>").text();
      } else if (model.error.data) {
        $scope.response = angular.toJson(model.error.data, true);
      } else if (model.error.message) {
        $scope.message = model.error.message;
      }

      if (model.error.config && model.error.config.params) {
        $scope.request_parameters = _.map(model.error.config.params, function(value, key) {
          return { key: key, value: value};
        });
      }

      if (model.error.stack) {
        $scope.editor.index = 2;
        $scope.stack_trace = model.error.stack;
        $scope.message = model.error.message;
      }

      if (model.error.config && model.error.config.data) {
        $scope.editor.index = 1;

        if (_.isString(model.error.config.data)) {
          $scope.request_parameters = getParametersFromQueryString(model.error.config.data);
        } else  {
          $scope.request_parameters = _.map(model.error.config.data, function(value, key) {
            return {key: key, value: angular.toJson(value, true)};
          });
        }
      }
    };

  });

});
