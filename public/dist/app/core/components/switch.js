import coreModule from 'app/core/core_module';
var template = "\n<label for=\"check-{{ctrl.id}}\" class=\"gf-form-switch-container\">\n  <div class=\"gf-form-label {{ctrl.labelClass}}\" ng-show=\"ctrl.label\">\n    {{ctrl.label}}\n    <info-popover mode=\"right-normal\" ng-if=\"ctrl.tooltip\" position=\"top center\">\n      {{ctrl.tooltip}}\n    </info-popover>\n  </div>\n  <div class=\"gf-form-switch {{ctrl.switchClass}}\" ng-if=\"ctrl.show\">\n    <input id=\"check-{{ctrl.id}}\" type=\"checkbox\" ng-model=\"ctrl.checked\" ng-change=\"ctrl.internalOnChange()\">\n    <span class=\"gf-form-switch__slider\"></span>\n  </div>\n</label>\n";
var checkboxTemplate = "\n<label for=\"check-{{ctrl.id}}\" class=\"gf-form-switch-container\">\n   <div class=\"gf-form-label {{ctrl.labelClass}}\" ng-show=\"ctrl.label\">\n    {{ctrl.label}}\n    <info-popover mode=\"right-normal\" ng-if=\"ctrl.tooltip\" position=\"top center\">\n      {{ctrl.tooltip}}\n    </info-popover>\n  </div>\n  <div class=\"gf-form-checkbox {{ctrl.switchClass}}\" ng-if=\"ctrl.show\">\n    <input id=\"check-{{ctrl.id}}\" type=\"checkbox\" ng-model=\"ctrl.checked\" ng-change=\"ctrl.internalOnChange()\">\n    <span class=\"gf-form-switch__checkbox\"></span>\n  </div>\n</label>\n";
var SwitchCtrl = /** @class */ (function () {
    /** @ngInject */
    function SwitchCtrl($scope, $timeout) {
        this.$timeout = $timeout;
        this.show = true;
        this.id = $scope.$id;
    }
    SwitchCtrl.prototype.internalOnChange = function () {
        var _this = this;
        return this.$timeout(function () {
            return _this.onChange();
        });
    };
    return SwitchCtrl;
}());
export { SwitchCtrl };
export function switchDirective() {
    return {
        restrict: 'E',
        controller: SwitchCtrl,
        controllerAs: 'ctrl',
        bindToController: true,
        scope: {
            checked: '=',
            label: '@',
            labelClass: '@',
            tooltip: '@',
            switchClass: '@',
            onChange: '&',
        },
        template: template,
    };
}
export function checkboxDirective() {
    return {
        restrict: 'E',
        controller: SwitchCtrl,
        controllerAs: 'ctrl',
        bindToController: true,
        scope: {
            checked: '=',
            label: '@',
            labelClass: '@',
            tooltip: '@',
            switchClass: '@',
            onChange: '&',
        },
        template: checkboxTemplate,
    };
}
coreModule.directive('gfFormSwitch', switchDirective);
coreModule.directive('gfFormCheckbox', checkboxDirective);
//# sourceMappingURL=switch.js.map