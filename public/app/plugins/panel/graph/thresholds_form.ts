import coreModule from 'app/core/core_module';
import config from 'app/core/config';
import tinycolor from 'tinycolor2';
export class ThresholdFormCtrl {
  panelCtrl: any;
  panel: any;
  disabled: boolean;

  /** @ngInject */
  constructor($scope) {
    this.panel = this.panelCtrl.panel;

    if (this.panel.alert) {
      this.disabled = true;
    }

    const unbindDestroy = $scope.$on('$destroy', () => {
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

  removeThreshold(index) {
    this.panel.thresholds.splice(index, 1);
    this.panelCtrl.render();
  }

  render() {
    this.panelCtrl.render();
  }

  onFillColorChange(index) {
    return newColor => {
      this.panel.thresholds[index].fillColor = newColor;
      this.render();
    };
  }

  onLineColorChange(index) {
    return newColor => {
      this.panel.thresholds[index].lineColor = newColor;
      this.render();
    };
  }

  onThresholdTypeChange(index) {
    // Because of the ng-model binding, threshold's color mode is already set here
    if (this.panel.thresholds[index].colorMode === 'custom') {
      this.panel.thresholds[index].fillColor = tinycolor(config.theme.colors.blueBase)
        .setAlpha(0.2)
        .toRgbString();
      this.panel.thresholds[index].lineColor = tinycolor(config.theme.colors.blueShade)
        .setAlpha(0.6)
        .toRgbString();
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
