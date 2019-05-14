import coreModule from 'app/core/core_module';
import { getColorModes } from './time_region_manager';
var TimeRegionFormCtrl = /** @class */ (function () {
    /** @ngInject */
    function TimeRegionFormCtrl($scope) {
        var _this = this;
        this.panel = this.panelCtrl.panel;
        var unbindDestroy = $scope.$on('$destroy', function () {
            _this.panelCtrl.editingTimeRegions = false;
            _this.panelCtrl.render();
            unbindDestroy();
        });
        this.colorModes = getColorModes();
        this.panelCtrl.editingTimeRegions = true;
    }
    TimeRegionFormCtrl.prototype.render = function () {
        this.panelCtrl.render();
    };
    TimeRegionFormCtrl.prototype.addTimeRegion = function () {
        this.panel.timeRegions.push({
            op: 'time',
            fromDayOfWeek: undefined,
            from: undefined,
            toDayOfWeek: undefined,
            to: undefined,
            colorMode: 'background6',
            fill: true,
            line: false,
            // Default colors for new
            fillColor: 'rgba(234, 112, 112, 0.12)',
            lineColor: 'rgba(237, 46, 24, 0.60)',
        });
        this.panelCtrl.render();
    };
    TimeRegionFormCtrl.prototype.removeTimeRegion = function (index) {
        this.panel.timeRegions.splice(index, 1);
        this.panelCtrl.render();
    };
    TimeRegionFormCtrl.prototype.onFillColorChange = function (index) {
        var _this = this;
        return function (newColor) {
            _this.panel.timeRegions[index].fillColor = newColor;
            _this.render();
        };
    };
    TimeRegionFormCtrl.prototype.onLineColorChange = function (index) {
        var _this = this;
        return function (newColor) {
            _this.panel.timeRegions[index].lineColor = newColor;
            _this.render();
        };
    };
    return TimeRegionFormCtrl;
}());
export { TimeRegionFormCtrl };
coreModule.directive('graphTimeRegionForm', function () {
    return {
        restrict: 'E',
        templateUrl: 'public/app/plugins/panel/graph/time_regions_form.html',
        controller: TimeRegionFormCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        scope: {
            panelCtrl: '=',
        },
    };
});
//# sourceMappingURL=time_regions_form.js.map