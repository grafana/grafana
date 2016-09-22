///<reference path="../../../headers/common.d.ts" />

import kbn from 'app/core/utils/kbn';

export class AxesEditorCtrl {
  panel: any;
  panelCtrl: any;
  unitFormats: any;
  logScales: any;
  xAxisModes: any;
  xAxisStatOptions: any;
  xNameSegment: any;

  /** @ngInject **/
  constructor(private $scope, private $q) {
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;
    $scope.ctrl = this;

    this.unitFormats = kbn.getUnitFormats();

    this.logScales = {
      'linear': 1,
      'log (base 2)': 2,
      'log (base 10)': 10,
      'log (base 32)': 32,
      'log (base 1024)': 1024
    };

    this.xAxisModes = {
      'Time': 'time',
      'Series': 'series',
      'Custom': 'custom'
    };

    this.xAxisStatOptions =  [
      {text: 'Avg', value: 'avg'},
      {text: 'Min', value: 'min'},
      {text: 'Max', value: 'min'},
      {text: 'Total', value: 'total'},
      {text: 'Count', value: 'count'},
    ];
  }

  setUnitFormat(axis, subItem) {
    axis.format = subItem.value;
    this.panelCtrl.render();
  }

  render() {
    this.panelCtrl.render();
  }

  xAxisOptionChanged()  {
    switch (this.panel.xaxis.mode) {
      case 'time': {
        this.panel.bars = false;
        this.panel.lines = true;
        this.panel.points = false;
        this.panel.legend.show = true;
        this.panel.tooltip.shared = true;
        this.panel.xaxis.values = [];
        this.panelCtrl.onDataReceived(this.panelCtrl.dataList);
        break;
      }
      case 'series': {
        this.panel.bars = true;
        this.panel.lines = false;
        this.panel.points = false;
        this.panel.stack = false;
        this.panel.legend.show = false;
        this.panel.tooltip.shared = false;
        this.panelCtrl.processor.validateXAxisSeriesValue();
        this.panelCtrl.onDataReceived(this.panelCtrl.dataList);
        break;
      }
    }
  }

  getXAxisNameOptions()  {
    return this.$q.when([
      {text: 'Avg', value: 'avg'}
    ]);
  }

  getXAxisValueOptions()  {
    return this.$q.when(this.panelCtrl.processor.getXAxisValueOptions({
      dataList: this.panelCtrl.dataList
    }));
  }

}

/** @ngInject **/
export function axesEditorComponent() {
  'use strict';
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'public/app/plugins/panel/graph/tab_axes.html',
    controller: AxesEditorCtrl,
  };
}
