///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

export class EditViewCtrl {

  constructor($scope) {
    $scope.indexPatternTypes = [
      {name: 'No pattern',  value: undefined},
      {name: 'Hourly',      value: 'Hourly',  example: '[logstash-]YYYY.MM.DD.HH'},
      {name: 'Daily',       value: 'Daily',   example: '[logstash-]YYYY.MM.DD'},
      {name: 'Weekly',      value: 'Weekly',  example: '[logstash-]GGGG.WW'},
      {name: 'Monthly',     value: 'Monthly', example: '[logstash-]YYYY.MM'},
      {name: 'Yearly',      value: 'Yearly',  example: '[logstash-]YYYY'},
    ];

    $scope.esVersions = [
      {name: '1.x', value: 1},
      {name: '2.x', value: 2},
    ];

    $scope.indexPatternTypeChanged = function() {
      var def = _.findWhere($scope.indexPatternTypes, {value: $scope.current.jsonData.interval});
      $scope.current.database = def.example || 'es-index-name';
    };
  }
}

function editViewDirective() {
  return {
    templateUrl: 'app/plugins/datasource/elasticsearch/partials/edit_view.html',
    controller: EditViewCtrl,
  };
};


export default editViewDirective;
