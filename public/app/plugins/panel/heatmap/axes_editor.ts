///<reference path="../../../headers/common.d.ts" />

import kbn from 'app/core/utils/kbn';

export class AxesEditorCtrl {
  panel: any;
  panelCtrl: any;
  unitFormats: any;
  logScales: any;
  dataFormats: any;
  yBucketOptions: any[];
  xBucketOptions: any[];

  /** @ngInject */
  constructor($scope, uiSegmentSrv) {
    $scope.editor = this;
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;
    this.unitFormats = kbn.getUnitFormats();

    this.logScales = {
      'linear': 1,
      'log (base 2)': 2,
      'log (base 10)': 10,
      'log (base 32)': 32,
      'log (base 1024)': 1024
    };

    this.dataFormats = {
      'Time series': 'timeseries',
      'Time series Pre-bucketed': 'tsbuckets'
    };

    this.yBucketOptions =  [
      {text: '5',  value: '5'},
      {text: '10', value: '10'},
      {text: '20', value: '20'},
      {text: '30', value: '30'},
      {text: '50', value: '50'},
    ];

    this.xBucketOptions =  [
      {text: '15', value: '15'},
      {text: '20', value: '20'},
      {text: '30', value: '30'},
      {text: '50', value: '50'},
      {text: '1m', value: '1m'},
      {text: '5m', value: '5m'},
      {text: '10m', value: '10m'},
      {text: '20m', value: '20m'},
      {text: '1h', value: '1h'},
    ];
  }

  setUnitFormat(subItem) {
    this.panel.yAxis.format = subItem.value;
    this.panelCtrl.render();
  }
}

/** @ngInject */
export function axesEditor() {
  'use strict';
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'public/app/plugins/panel/heatmap/partials/axes_editor.html',
    controller: AxesEditorCtrl,
  };
}
