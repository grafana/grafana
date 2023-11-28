import { EchoEventType, isInteractionEvent, isPageviewEvent, } from '@grafana/runtime';
import { loadScript } from '../../utils';
export class ApplicationInsightsBackend {
    constructor(options) {
        this.options = options;
        this.supportedEvents = [EchoEventType.Pageview, EchoEventType.Interaction];
        this.addEvent = (e) => {
            var _a, _b, _c, _d;
            if (!window.applicationInsights) {
                return;
            }
            if (isPageviewEvent(e)) {
                (_b = (_a = window.applicationInsights).trackPageView) === null || _b === void 0 ? void 0 : _b.call(_a);
            }
            if (isInteractionEvent(e)) {
                (_d = (_c = window.applicationInsights).trackEvent) === null || _d === void 0 ? void 0 : _d.call(_c, {
                    name: e.payload.interactionName,
                    properties: e.payload.properties,
                });
            }
        };
        // Not using Echo buffering, addEvent above sends events to Application Insights as soon as they appear
        this.flush = () => { };
        const applicationInsightsOpts = {
            config: {
                connectionString: options.connectionString,
                endpointUrl: options.endpointUrl,
            },
        };
        const url = 'https://js.monitor.azure.com/scripts/b/ai.2.min.js';
        loadScript(url).then(() => {
            const init = new window.Microsoft.ApplicationInsights.ApplicationInsights(applicationInsightsOpts);
            window.applicationInsights = init.loadAppInsights();
        });
    }
}
//# sourceMappingURL=ApplicationInsightsBackend.js.map