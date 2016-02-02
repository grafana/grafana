///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

export class QueryCtrl {
  target: any;
  datasource: any;
  panelCtrl: any;
  panel: any;

  constructor(public $scope, private $injector) {
    this.panel = this.panelCtrl.panel;

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

  removeQuery() {
    this.panel.targets = _.without(this.panel.targets, this.target);
    this.panelCtrl.refresh();
  };

  duplicateQuery() {
    var clone = angular.copy(this.target);
    clone.refId = this.getNextQueryLetter();
    this.panel.targets.push(clone);
  }

  moveQuery(direction) {
    var index = _.indexOf(this.panel.targets, this.target);
    _.move(this.panel.targets, index, index + direction);
  }

  refresh() {
    this.panelCtrl.refresh();
  }

  toggleHideQuery() {
    this.target.hide = !this.target.hide;
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
