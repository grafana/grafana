import $ from 'jquery';
import coreModule from 'app/core/core_module';
import config from 'app/core/config';
var Analytics = /** @class */ (function () {
    /** @ngInject */
    function Analytics($rootScope, $location) {
        this.$rootScope = $rootScope;
        this.$location = $location;
    }
    Analytics.prototype.gaInit = function () {
        $.ajax({
            url: 'https://www.google-analytics.com/analytics.js',
            dataType: 'script',
            cache: true,
        });
        var ga = (window.ga =
            window.ga ||
                //tslint:disable-next-line:only-arrow-functions
                function () {
                    (ga.q = ga.q || []).push(arguments);
                });
        ga.l = +new Date();
        ga('create', config.googleAnalyticsId, 'auto');
        ga('set', 'anonymizeIp', true);
        return ga;
    };
    Analytics.prototype.init = function () {
        var _this = this;
        this.$rootScope.$on('$viewContentLoaded', function () {
            var track = { page: _this.$location.url() };
            var ga = window.ga || _this.gaInit();
            ga('set', track);
            ga('send', 'pageview');
        });
    };
    return Analytics;
}());
export { Analytics };
/** @ngInject */
function startAnalytics(googleAnalyticsSrv) {
    if (config.googleAnalyticsId) {
        googleAnalyticsSrv.init();
    }
}
coreModule.service('googleAnalyticsSrv', Analytics).run(startAnalytics);
//# sourceMappingURL=analytics.js.map