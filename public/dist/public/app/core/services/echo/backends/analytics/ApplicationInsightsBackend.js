import $ from 'jquery';
import { EchoEventType, isInteractionEvent, isPageviewEvent, } from '@grafana/runtime';
var ApplicationInsightsBackend = /** @class */ (function () {
    function ApplicationInsightsBackend(options) {
        this.options = options;
        this.supportedEvents = [EchoEventType.Pageview, EchoEventType.Interaction];
        this.addEvent = function (e) {
            if (!window.applicationInsights) {
                return;
            }
            if (isPageviewEvent(e)) {
                window.applicationInsights.trackPageView();
            }
            if (isInteractionEvent(e)) {
                window.applicationInsights.trackEvent({
                    name: e.payload.interactionName,
                    properties: e.payload.properties,
                });
            }
        };
        // Not using Echo buffering, addEvent above sends events to Application Insights as soon as they appear
        this.flush = function () { };
        $.ajax({
            url: 'https://js.monitor.azure.com/scripts/b/ai.2.min.js',
            dataType: 'script',
            cache: true,
        }).done(function () {
            var applicationInsightsOpts = {
                config: {
                    connectionString: options.connectionString,
                    endpointUrl: options.endpointUrl,
                },
            };
            var init = new window.Microsoft.ApplicationInsights.ApplicationInsights(applicationInsightsOpts);
            window.applicationInsights = init.loadAppInsights();
        });
    }
    return ApplicationInsightsBackend;
}());
export { ApplicationInsightsBackend };
//# sourceMappingURL=ApplicationInsightsBackend.js.map