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
        Panel data source
      </label>

      <metric-segment segment="ctrl.dsSegment" style-mode="select"
                      get-options="ctrl.getOptions()"
                      on-change="ctrl.datasourceChanged()"></metric-segment>
    </div>

    <div class="gf-form gf-form--offset-1">
      <button class="btn btn-inverse gf-form-btn" ng-click="ctrl.addDataQuery()" ng-hide="ctrl.current.meta.mixed">
        <i class="fa fa-plus"></i>&nbsp;
        Add query
      </button>

      <div class="dropdown" ng-if="ctrl.current.meta.mixed">
        <button class="btn btn-inverse dropdown-toggle gf-form-btn" data-toggle="dropdown">
          Add Query&nbsp;<span class="fa fa-caret-down"></span>
        </button>

        <ul class="dropdown-menu" role="menu">
          <li ng-repeat="datasource in ctrl.datasources" role="menuitem" ng-hide="datasource.meta.builtIn">
            <a ng-click="ctrl.addDataQuery(datasource);">{{datasource.name}}</a>
          </li>
        </ul>
      </div>
    </div>
  </div>
</div>
`;


export class MetricsDsSelectorCtrl {
  dsSegment: any;
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

    this.dsSegment = uiSegmentSrv.newSegment(this.current.name);
  }

  getOptions() {
    return Promise.resolve(this.datasources.map(value => {
      return this.uiSegmentSrv.newSegment(value.name);
    }));
  }

  datasourceChanged() {
    var ds = _.findWhere(this.datasources, {name: this.dsSegment.value});
    if (ds) {
      this.current = ds;
      this.panelCtrl.setDatasource(ds);
    }
  }

  addDataQuery(datasource) {
    var target: any = {isNew: true};

    if (datasource) {
      target.datasource = datasource.name;
    }

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
