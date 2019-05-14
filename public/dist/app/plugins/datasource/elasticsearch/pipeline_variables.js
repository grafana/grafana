import coreModule from 'app/core/core_module';
export function elasticPipelineVariables() {
    return {
        templateUrl: 'public/app/plugins/datasource/elasticsearch/partials/pipeline_variables.html',
        controller: 'ElasticPipelineVariablesCtrl',
        restrict: 'E',
        scope: {
            onChange: '&',
            variables: '=',
            options: '=',
        },
    };
}
var newVariable = function (index) {
    return {
        name: 'var' + index,
        pipelineAgg: 'select metric',
    };
};
var ElasticPipelineVariablesCtrl = /** @class */ (function () {
    /** @ngInject */
    function ElasticPipelineVariablesCtrl($scope) {
        $scope.variables = $scope.variables || [newVariable(1)];
        $scope.onChangeInternal = function () {
            $scope.onChange();
        };
        $scope.add = function () {
            $scope.variables.push(newVariable($scope.variables.length + 1));
            $scope.onChange();
        };
        $scope.remove = function (index) {
            $scope.variables.splice(index, 1);
            $scope.onChange();
        };
    }
    return ElasticPipelineVariablesCtrl;
}());
export { ElasticPipelineVariablesCtrl };
coreModule.directive('elasticPipelineVariables', elasticPipelineVariables);
coreModule.controller('ElasticPipelineVariablesCtrl', ElasticPipelineVariablesCtrl);
//# sourceMappingURL=pipeline_variables.js.map