///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import appEvents  from 'app/core/app_events';

var module = angular.module('grafana.directives');

var template = `

<div class="gf-form-group" ng-if="ctrl.showResponse">
  <response-viewer response="ctrl.responseData" />
</div>

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
      <button class="btn btn-inverse gf-form-btn" ng-click="ctrl.addDataQuery()" ng-hide="ctrl.current.meta.mixed">
        <i class="fa fa-plus"></i>&nbsp;
        Add Query
      </button>

      <div class="dropdown" ng-if="ctrl.current.meta.mixed">
        <metric-segment segment="ctrl.mixedDsSegment"
                        get-options="ctrl.getOptions(false)"
                        on-change="ctrl.mixedDatasourceChanged()"></metric-segment>
      </div>
    </div>

    <div class="gf-form gf-form--offset-1">
      <button class="btn btn-inverse gf-form-btn" ng-click="ctrl.toggleShowResponse()" ng-show="ctrl.responseData">
        <i class="fa fa-binoculars"></i>&nbsp;
        Request & Response
      </button>
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
  lastResponse: any;
  responseData: any;
  showResponse: boolean;

  /** @ngInject */
  constructor($scope, private uiSegmentSrv, datasourceSrv) {
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
    this.mixedDsSegment = uiSegmentSrv.newSegment({value: 'Add Query', selectMode: true});

    appEvents.on('ds-request-response', this.onRequestResponse.bind(this), $scope);
    appEvents.on('ds-request-error', this.onRequestError.bind(this), $scope);
  }

  onRequestResponse(data) {
    this.responseData = data;
  }

  toggleShowResponse() {
    this.showResponse = !this.showResponse;
  }

  onRequestError(err) {
    this.responseData = err;
    this.responseData.isError = true;
    this.showResponse = true;
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
      this.responseData = null;
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
