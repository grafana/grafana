import coreModule from '../../core_module';
import appEvents from 'app/core/app_events';
var NavbarCtrl = /** @class */ (function () {
    /** @ngInject */
    function NavbarCtrl() {
    }
    NavbarCtrl.prototype.showSearch = function () {
        appEvents.emit('show-dash-search');
    };
    NavbarCtrl.prototype.navItemClicked = function (navItem, evt) {
        if (navItem.clickHandler) {
            navItem.clickHandler();
            evt.preventDefault();
        }
    };
    return NavbarCtrl;
}());
export { NavbarCtrl };
export function navbarDirective() {
    return {
        restrict: 'E',
        templateUrl: 'public/app/core/components/navbar/navbar.html',
        controller: NavbarCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        scope: {
            model: '=',
        },
        link: function (scope, elem) { },
    };
}
export function pageH1() {
    return {
        restrict: 'E',
        template: "\n    <h1 class=\"page-header__title\">\n      <i class=\"page-header__icon {{::model.header.icon}}\" ng-if=\"::model.header.icon\"></i>\n      <img class=\"page-header__img\" ng-src=\"{{::model.header.img}}\" ng-if=\"::model.header.img\"></i>\n      {{model.header.text}}\n    </h1>\n    ",
        scope: {
            model: '=',
        },
    };
}
coreModule.directive('pageH1', pageH1);
coreModule.directive('navbar', navbarDirective);
//# sourceMappingURL=navbar.js.map