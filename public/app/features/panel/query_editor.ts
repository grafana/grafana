///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

export class QueryEditorCtrl {
  target: any;
  datasource: any;
  panelCtrl: any;
  panel: any;

  constructor(private $scope, private $injector) {
    this.panel = this.panelCtrl.panel;
    this.datasource = $scope.datasource;

    if (!this.target.refId) {
      this.target.refId = this.getNextQueryLetter();
    }
  }

  getNextQueryLetter() {
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    return _.find(letters, refId => {
      return _.every(this.panel.targets, function(other) {
        return other.refId !== refId;
      });
    });
  }

  removeDataQuery(query) {
    this.panel.targets = _.without(this.panel.targets, query);
    this.panelCtrl.refresh();
  };

  duplicateDataQuery(query) {
    var clone = angular.copy(query);
    clone.refId = this.getNextQueryLetter();
    this.panel.targets.push(clone);
  }

  moveDataQuery(direction) {
    var index = _.indexOf(this.panel.targets, this.target);
    _.move(this.panel.targets, index, index + direction);
  }

  toggleHideQuery(target) {
    target.hide = !target.hide;
    this.panelCtrl.refresh();
  }
}

// var directivesModule = angular.module('grafana.directives');
//
// /** @ngInject */
// function metricsQueryOptions(dynamicDirectiveSrv, datasourceSrv) {
//   return dynamicDirectiveSrv.create({
//     watchPath: "ctrl.panel.datasource",
//     directive: scope => {
//       return datasourceSrv.get(scope.ctrl.panel.datasource).then(ds => {
//         return System.import(ds.meta.module).then(dsModule => {
//           return {
//             name: 'metrics-query-options-' + ds.meta.id,
//             fn: dsModule.metricsQueryOptions
//           };
//         });
//       });
//     }
//   });
// }
//
// directivesModule.directive('metricsQueryOptions', metricsQueryOptions);
