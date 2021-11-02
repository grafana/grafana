import $ from 'jquery';
import { EchoEventType } from '@grafana/runtime';
var GAEchoBackend = /** @class */ (function () {
    function GAEchoBackend(options) {
        this.options = options;
        this.supportedEvents = [EchoEventType.Pageview];
        this.addEvent = function (e) {
            if (!window.ga) {
                return;
            }
            window.ga('set', { page: e.payload.page });
            window.ga('send', 'pageview');
        };
        // Not using Echo buffering, addEvent above sends events to GA as soon as they appear
        this.flush = function () { };
        var url = "https://www.google-analytics.com/analytics" + (options.debug ? '_debug' : '') + ".js";
        $.ajax({
            url: url,
            dataType: 'script',
            cache: true,
        });
        var ga = (window.ga =
            window.ga ||
                // this had the equivalent of `eslint-disable-next-line prefer-arrow/prefer-arrow-functions`
                function () {
                    (ga.q = ga.q || []).push(arguments);
                });
        ga.l = +new Date();
        ga('create', options.googleAnalyticsId, 'auto');
        ga('set', 'anonymizeIp', true);
    }
    return GAEchoBackend;
}());
export { GAEchoBackend };
//# sourceMappingURL=GABackend.js.map