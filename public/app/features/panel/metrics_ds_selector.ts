///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

var module = angular.module('grafana.directives');

var template = `
<div class="gf-form-group">
  <div class="gf-form-inline">
    <div class="gf-form">
      <label class="gf-form-label">
        <i class="icon-gf icon-gf-datasources"></i>
      </label>
      <label class="gf-form-label">
        Data Source
      </label>

      <metric-segment segment="ctrl.dsSegment"
                      get-options="ctrl.getOptions(true)"
                      on-change="ctrl.datasourceChanged()"></metric-segment>
    </div>

    <div class="gf-form gf-form--offset-1">
      <button class="btn btn-secondary gf-form-btn" ng-click="ctrl.addDataQuery()" ng-hide="ctrl.current.meta.mixed">
        <i class="fa fa-plus"></i>&nbsp;
        Add query
      </button>

      <div class="dropdown" ng-if="ctrl.current.meta.mixed">
        <metric-segment segment="ctrl.mixedDsSegment"
                        get-options="ctrl.getOptions(false)"
                        on-change="ctrl.mixedDatasourceChanged()"></metric-segment>
      </div>
    </div>
  </div>
</div>
`;


export class MetricsDsSelectorCtrl {
  dsSegment: any;
  mixedDsSegment: any;
  dsName: string;
  panelCtrl: any;
  datasources: any[];
  current: any;

  /** @ngInject */
  constructor(private uiSegmentSrv, datasourceSrv) {
    this.datasources = datasourceSrv.getMetricSources();

    var dsValue = this.panelCtrl.panel.datasource || null;

    for (let ds of this.datasources) {
      if (ds.value === dsValue) {
        this.current = ds;
      }
    }

    if (!this.current) {
      this.current = {name: dsValue + ' not found', value: null};
    }

    this.dsSegment = uiSegmentSrv.newSegment({value: this.current.name, selectMode: true});
    this.mixedDsSegment = uiSegmentSrv.newSegment({value: 'Add query', selectMode: true});
  }

  getOptions(includeBuiltin) {
    return Promise.resolve(this.datasources.filter(value => {
      return includeBuiltin || !value.meta.builtIn;
    }).map(value => {
      return this.uiSegmentSrv.newSegment(value.name);
    }));
  }

  datasourceChanged() {
    var ds = _.find(this.datasources, {name: this.dsSegment.value});
    if (ds) {
      this.current = ds;
      this.panelCtrl.setDatasource(ds);
    }
  }

  mixedDatasourceChanged() {
    var target: any = {isNew: true};
    var ds = _.find(this.datasources, {name: this.mixedDsSegment.value});
    if (ds) {
      target.datasource = ds.name;
      this.panelCtrl.panel.targets.push(target);
      this.mixedDsSegment.value = '';
    }
  }

  addDataQuery() {
    var target: any = {isNew: true};
    this.panelCtrl.panel.targets.push(target);
  }
}

module.directive('metricsDsSelector', function() {
  return {
    restrict: 'E',
    template: template,
    controller: MetricsDsSelectorCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    transclude: true,
    scope: {
      panelCtrl: "="
    }
  };
});
