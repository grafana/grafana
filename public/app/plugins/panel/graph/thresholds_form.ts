import coreModule from 'app/core/core_module';

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
