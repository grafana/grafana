import config from 'app/core/config';
var StyleGuideCtrl = /** @class */ (function () {
    /** @ngInject */
    function StyleGuideCtrl($routeParams, backendSrv, navModelSrv) {
        this.$routeParams = $routeParams;
        this.backendSrv = backendSrv;
        this.buttonNames = ['primary', 'secondary', 'inverse', 'success', 'warning', 'danger'];
        this.buttonSizes = ['btn-small', '', 'btn-large'];
        this.buttonVariants = ['-'];
        this.navModel = navModelSrv.getNav('admin', 'styleguide', 0);
        this.theme = config.bootData.user.lightTheme ? 'light' : 'dark';
    }
    StyleGuideCtrl.prototype.switchTheme = function () {
        this.$routeParams.theme = this.theme === 'dark' ? 'light' : 'dark';
        var cmd = {
            theme: this.$routeParams.theme,
        };
        this.backendSrv.put('/api/user/preferences', cmd).then(function () {
            window.location.href = window.location.href;
        });
    };
    return StyleGuideCtrl;
}());
export default StyleGuideCtrl;
//# sourceMappingURL=StyleGuideCtrl.js.map