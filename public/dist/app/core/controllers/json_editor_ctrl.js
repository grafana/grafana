import angular from 'angular';
import coreModule from '../core_module';
var JsonEditorCtrl = /** @class */ (function () {
    /** @ngInject */
    function JsonEditorCtrl($scope) {
        $scope.json = angular.toJson($scope.model.object, true);
        $scope.canUpdate = $scope.model.updateHandler !== void 0 && $scope.model.canUpdate;
        $scope.canCopy = $scope.model.enableCopy;
        $scope.update = function () {
            var newObject = angular.fromJson($scope.json);
            $scope.model.updateHandler(newObject, $scope.model.object);
        };
        $scope.getContentForClipboard = function () { return $scope.json; };
    }
    return JsonEditorCtrl;
}());
export { JsonEditorCtrl };
coreModule.controller('JsonEditorCtrl', JsonEditorCtrl);
//# sourceMappingURL=json_editor_ctrl.js.map