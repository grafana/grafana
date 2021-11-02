import $ from 'jquery';
import { EchoEventType, isInteractionEvent, isPageviewEvent } from '@grafana/runtime';
var RudderstackBackend = /** @class */ (function () {
    function RudderstackBackend(options) {
        this.options = options;
        this.supportedEvents = [EchoEventType.Pageview, EchoEventType.Interaction];
        this.addEvent = function (e) {
            if (!window.rudderanalytics) {
                return;
            }
            if (isPageviewEvent(e)) {
                window.rudderanalytics.page();
            }
            if (isInteractionEvent(e)) {
                window.rudderanalytics.track(e.payload.interactionName, e.payload.properties);
            }
        };
        // Not using Echo buffering, addEvent above sends events to GA as soon as they appear
        this.flush = function () { };
        var url = "https://cdn.rudderlabs.com/v1/rudder-analytics.min.js";
        $.ajax({
            url: url,
            dataType: 'script',
            cache: true,
        });
        var rds = (window.rudderanalytics = []);
        var methods = [
            'load',
            'page',
            'track',
            'identify',
            'alias',
            'group',
            'ready',
            'reset',
            'getAnonymousId',
            'setAnonymousId',
        ];
        for (var i = 0; i < methods.length; i++) {
            var method = methods[i];
            rds[method] = (function (methodName) {
                return function () {
                    // @ts-ignore
                    rds.push([methodName].concat(Array.prototype.slice.call(arguments)));
                };
            })(method);
        }
        rds.load(options.writeKey, options.dataPlaneUrl);
        if (options.user) {
            rds.identify(options.user.email, {
                email: options.user.email,
                orgId: options.user.orgId,
            });
        }
    }
    return RudderstackBackend;
}());
export { RudderstackBackend };
//# sourceMappingURL=RudderstackBackend.js.map