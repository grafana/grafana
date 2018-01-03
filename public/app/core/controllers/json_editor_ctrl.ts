import angular from 'angular';
import coreModule from '../core_module';

export class JsonEditorCtrl {
  /** @ngInject */
  constructor($scope) {
    $scope.json = angular.toJson($scope.object, true);
    $scope.canUpdate = $scope.updateHandler !== void 0 && $scope.contextSrv.isEditor;
    $scope.canCopy = $scope.enableCopy;

    $scope.update = function() {
      var newObject = angular.fromJson($scope.json);
      $scope.updateHandler(newObject, $scope.object);
    };

    $scope.getContentForClipboard = () => $scope.json;
  }
}

coreModule.controller('JsonEditorCtrl', JsonEditorCtrl);
