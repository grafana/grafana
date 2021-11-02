import coreModule from 'app/core/core_module';
import config from 'app/core/config';
import tinycolor from 'tinycolor2';
var ThresholdFormCtrl = /** @class */ (function () {
    /** @ngInject */
    function ThresholdFormCtrl($scope) {
        this.$scope = $scope;
        this.disabled = false;
    }
    ThresholdFormCtrl.prototype.$onInit = function () {
        var _this = this;
        this.panel = this.panelCtrl.panel;
        if (this.panel.alert && !config.unifiedAlertingEnabled) {
            this.disabled = true;
        }
        var unbindDestroy = this.$scope.$on('$destroy', function () {
            _this.panelCtrl.editingThresholds = false;
            _this.panelCtrl.render();
            unbindDestroy();
        });
        this.panelCtrl.editingThresholds = true;
    };
    ThresholdFormCtrl.prototype.addThreshold = function () {
        this.panel.thresholds.push({
            value: undefined,
            colorMode: 'critical',
            op: 'gt',
            fill: true,
            line: true,
            yaxis: 'left',
        });
        this.panelCtrl.render();
    };
    ThresholdFormCtrl.prototype.removeThreshold = function (index) {
        this.panel.thresholds.splice(index, 1);
        this.panelCtrl.render();
    };
    ThresholdFormCtrl.prototype.render = function () {
        this.panelCtrl.render();
    };
    ThresholdFormCtrl.prototype.onFillColorChange = function (index) {
        var _this = this;
        return function (newColor) {
            _this.panel.thresholds[index].fillColor = newColor;
            _this.render();
        };
    };
    ThresholdFormCtrl.prototype.onLineColorChange = function (index) {
        var _this = this;
        return function (newColor) {
            _this.panel.thresholds[index].lineColor = newColor;
            _this.render();
        };
    };
    ThresholdFormCtrl.prototype.onThresholdTypeChange = function (index) {
        // Because of the ng-model binding, threshold's color mode is already set here
        if (this.panel.thresholds[index].colorMode === 'custom') {
            this.panel.thresholds[index].fillColor = tinycolor(config.theme.palette.blue85).setAlpha(0.2).toRgbString();
            this.panel.thresholds[index].lineColor = tinycolor(config.theme.palette.blue77).setAlpha(0.6).toRgbString();
        }
        this.panelCtrl.render();
    };
    return ThresholdFormCtrl;
}());
export { ThresholdFormCtrl };
coreModule.directive('graphThresholdForm', function () {
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
//# sourceMappingURL=thresholds_form.js.map