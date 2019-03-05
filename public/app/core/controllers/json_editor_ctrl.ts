import angular from 'angular';
import coreModule from '../core_module';

export class JsonEditorCtrl {
  /** @ngInject */
  constructor($scope) {
    $scope.json = angular.toJson($scope.model.object, true);
    $scope.canUpdate = $scope.model.updateHandler !== void 0 && $scope.model.canUpdate;
    $scope.canCopy = $scope.model.enableCopy;

    $scope.update = () => {
      const newObject = angular.fromJson($scope.json);
      $scope.model.updateHandler(newObject, $scope.model.object);
    };

    $scope.getContentForClipboard = () => $scope.json;
  }
}

coreModule.controller('JsonEditorCtrl', JsonEditorCtrl);
