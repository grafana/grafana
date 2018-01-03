import angular from 'angular';
import _ from 'lodash';
import $ from 'jquery';
import coreModule from '../core_module';

export class InspectCtrl {
  /** @ngInject */
  constructor($scope, $sanitize) {
    var model = $scope.inspector;

    $scope.init = function() {
      $scope.editor = { index: 0 };

      if (!model.error) {
        return;
      }

      if (_.isString(model.error.data)) {
        $scope.response = $('<div>' + model.error.data + '</div>').text();
      } else if (model.error.data) {
        if (model.error.data.response) {
          $scope.response = $sanitize(model.error.data.response);
        } else {
          $scope.response = angular.toJson(model.error.data, true);
        }
      } else if (model.error.message) {
        $scope.message = model.error.message;
      }

      if (model.error.config && model.error.config.params) {
        $scope.request_parameters = _.map(model.error.config.params, function(value, key) {
          return { key: key, value: value };
        });
      }

      if (model.error.stack) {
        $scope.editor.index = 3;
        $scope.stack_trace = model.error.stack;
        $scope.message = model.error.message;
      }

      if (model.error.config && model.error.config.data) {
        $scope.editor.index = 2;

        if (_.isString(model.error.config.data)) {
          $scope.request_parameters = this.getParametersFromQueryString(model.error.config.data);
        } else {
          $scope.request_parameters = _.map(model.error.config.data, function(value, key) {
            return { key: key, value: angular.toJson(value, true) };
          });
        }
      }
    };
  }
  getParametersFromQueryString(queryString) {
    var result = [];
    var parameters = queryString.split('&');
    for (var i = 0; i < parameters.length; i++) {
      var keyValue = parameters[i].split('=');
      if (keyValue[1].length > 0) {
        result.push({
          key: keyValue[0],
          value: (<any>window).unescape(keyValue[1]),
        });
      }
    }
    return result;
  }
}

coreModule.controller('InspectCtrl', InspectCtrl);
