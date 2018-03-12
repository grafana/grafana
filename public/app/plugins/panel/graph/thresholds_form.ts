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

    var unbindDestroy = $scope.$on('$destroy', () => {
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

var template = `
<div class="gf-form-group">
  <h5>Thresholds</h5>
  <p class="muted" ng-show="ctrl.disabled">
    Visual thresholds options <strong>disabled.</strong>
    Visit the Alert tab update your thresholds. <br>
    To re-enable thresholds, the alert rule must be deleted from this panel.
  </p>
  <div ng-class="{'thresholds-form-disabled': ctrl.disabled}">
    <div class="gf-form-inline" ng-repeat="threshold in ctrl.panel.thresholds">
      <div class="gf-form">
        <label class="gf-form-label">T{{$index+1}}</label>
      </div>

      <div class="gf-form">
        <div class="gf-form-select-wrapper">
          <select class="gf-form-input" ng-model="threshold.op"
                  ng-options="f for f in ['gt', 'lt']" ng-change="ctrl.render()" ng-disabled="ctrl.disabled"></select>
        </div>
        <input type="number" ng-model="threshold.value" class="gf-form-input width-8"
               ng-change="ctrl.render()" placeholder="value" ng-disabled="ctrl.disabled">
      </div>

      <div class="gf-form">
        <label class="gf-form-label">Color</label>
        <div class="gf-form-select-wrapper">
          <select class="gf-form-input" ng-model="threshold.colorMode"
                  ng-options="f for f in ['custom', 'critical', 'warning', 'ok']" ng-change="ctrl.render()" ng-disabled="ctrl.disabled">
          </select>
        </div>
      </div>

      <gf-form-switch class="gf-form" label="Fill" checked="threshold.fill"
                      on-change="ctrl.render()" ng-disabled="ctrl.disabled"></gf-form-switch>

      <div class="gf-form" ng-if="threshold.fill && threshold.colorMode === 'custom'">
        <label class="gf-form-label">Fill color</label>
        <span class="gf-form-label">
          <color-picker color="threshold.fillColor" onChange="ctrl.onFillColorChange($index)"></color-picker>
        </span>
      </div>

      <gf-form-switch class="gf-form" label="Line" checked="threshold.line"
                      on-change="ctrl.render()" ng-disabled="ctrl.disabled"></gf-form-switch>

      <div class="gf-form" ng-if="threshold.line && threshold.colorMode === 'custom'">
        <label class="gf-form-label">Line color</label>
        <span class="gf-form-label">
          <color-picker color="threshold.lineColor" onChange="ctrl.onLineColorChange($index)"></color-picker>
        </span>
      </div>

      <div class="gf-form">
        <label class="gf-form-label">Y-Axis</label>
        <div class="gf-form-select-wrapper">
          <select class="gf-form-input" ng-model="threshold.yaxis"
                  ng-init="threshold.yaxis = threshold.yaxis === 'left' || threshold.yaxis === 'right' ? threshold.yaxis : 'left'"
                  ng-options="f for f in ['left', 'right']" ng-change="ctrl.render()" ng-disabled="ctrl.disabled">
          </select>
        </div>
      </div>

      <div class="gf-form">
        <label class="gf-form-label">
          <a class="pointer" ng-click="ctrl.removeThreshold($index)" ng-disabled="ctrl.disabled">
            <i class="fa fa-trash"></i>
          </a>
        </label>
      </div>
    </div>

    <div class="gf-form-button-row">
      <button class="btn btn-inverse" ng-click="ctrl.addThreshold()" ng-disabled="ctrl.disabled">
        <i class="fa fa-plus"></i>&nbsp;Add Threshold
      </button>
    </div>
  </div>
</div>
`;

coreModule.directive('graphThresholdForm', function() {
  return {
    restrict: 'E',
    template: template,
    controller: ThresholdFormCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      panelCtrl: '=',
    },
  };
});
