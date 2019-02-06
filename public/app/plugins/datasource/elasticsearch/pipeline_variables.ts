import coreModule from 'app/core/core_module';
import _ from 'lodash';

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

const newVariable = index => {
  return {
    name: 'var' + index,
    pipelineAgg: 'select metric',
  };
};

export class ElasticPipelineVariablesCtrl {
  /** @ngInject */
  constructor($scope) {
    $scope.variables = $scope.variables || [newVariable(1)];

    $scope.onChangeInternal = () => {
      $scope.onChange();
    };

    $scope.add = () => {
      $scope.variables.push(newVariable($scope.variables.length + 1));
      $scope.onChange();
    };

    $scope.remove = index => {
      $scope.variables.splice(index, 1);
      $scope.onChange();
    };
  }
}

coreModule.directive('elasticPipelineVariables', elasticPipelineVariables);
coreModule.controller('ElasticPipelineVariablesCtrl', ElasticPipelineVariablesCtrl);
