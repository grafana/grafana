export class AxesEditorCtrl {
  panel: any;
  panelCtrl: any;
  logScales: any;
  dataFormats: any;
  yBucketBoundModes: any;

  /** @ngInject */
  constructor($scope: any, uiSegmentSrv: any) {
    $scope.editor = this;
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;

    this.logScales = {
      linear: 1,
      'log (base 2)': 2,
      'log (base 10)': 10,
      'log (base 32)': 32,
      'log (base 1024)': 1024,
    };

    this.dataFormats = {
      'Time series': 'timeseries',
      'Time series buckets': 'tsbuckets',
    };

    this.yBucketBoundModes = {
      Auto: 'auto',
      Upper: 'upper',
      Lower: 'lower',
      Middle: 'middle',
    };
  }

  setUnitFormat = (unit: string) => {
    this.panel.yAxis.format = unit;
    this.panelCtrl.render();
  };
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
