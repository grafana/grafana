import tinycolor from 'tinycolor2';

import coreModule from 'app/angular/core_module';
import config from 'app/core/config';
export class ThresholdFormCtrl {
  panelCtrl: any;
  panel: any;
  disabled = false;

  static $inject = ['$scope'];

  constructor(private $scope: any) {}

  $onInit() {
    this.panel = this.panelCtrl.panel;

    if (this.panel.alert && !config.unifiedAlertingEnabled) {
      this.disabled = true;
    }

    const unbindDestroy = this.$scope.$on('$destroy', () => {
      this.panelCtrl.editingThresholds = false;
      this.panelCtrl.render();
      unbindDestroy();
    });

    this.panelCtrl.editingThresholds = true;
  }

  addThreshold() {
    this.panel.thresholds.push({
      value: undefined,
      colorMode: 'critical',
      op: 'gt',
      fill: true,
      line: true,
      yaxis: 'left',
    });
    this.panelCtrl.render();
  }

  removeThreshold(index: number) {
    this.panel.thresholds.splice(index, 1);
    this.panelCtrl.render();
  }

  render() {
    this.panelCtrl.render();
  }

  onFillColorChange(index: number) {
    return (newColor: string) => {
      this.panel.thresholds[index].fillColor = newColor;
      this.render();
    };
  }

  onLineColorChange(index: number) {
    return (newColor: string) => {
      this.panel.thresholds[index].lineColor = newColor;
      this.render();
    };
  }

  onThresholdTypeChange(index: number) {
    // Because of the ng-model binding, threshold's color mode is already set here
    if (this.panel.thresholds[index].colorMode === 'custom') {
      this.panel.thresholds[index].fillColor = tinycolor(config.theme2.v1.palette.blue85).setAlpha(0.2).toRgbString();
      this.panel.thresholds[index].lineColor = tinycolor(config.theme2.v1.palette.blue77).setAlpha(0.6).toRgbString();
    }
    this.panelCtrl.render();
  }
}

coreModule.directive('graphThresholdForm', () => {
  return {
    restrict: 'E',
    templateUrl: 'public/app/plugins/panel/graph/thresholds_form.html',
    controller: ThresholdFormCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      panelCtrl: '=',
    },
  };
});
