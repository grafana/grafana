import { EchoEventType } from '@grafana/runtime';
import { loadScript } from '../../utils';
export class GA4EchoBackend {
    constructor(options) {
        this.options = options;
        this.supportedEvents = [EchoEventType.Pageview];
        this.googleAnalytics4SendManualPageViews = false;
        this.addEvent = (e) => {
            if (!window.gtag) {
                return;
            }
            // this should prevent duplicate events in case enhanced tracking is enabled
            if (this.googleAnalytics4SendManualPageViews) {
                window.gtag('event', 'page_view', { page_path: e.payload.page });
            }
        };
        // Not using Echo buffering, addEvent above sends events to GA as soon as they appear
        this.flush = () => { };
        const url = `https://www.googletagmanager.com/gtag/js?id=${options.googleAnalyticsId}`;
        loadScript(url, true);
        window.dataLayer = window.dataLayer || [];
        window.gtag = function gtag() {
            window.dataLayer.push(arguments);
        };
        window.gtag('js', new Date());
        const configOptions = {
            page_path: window.location.pathname,
        };
        if (options.user) {
            configOptions.user_id = options.user.analytics.identifier;
        }
        this.googleAnalytics4SendManualPageViews = options.googleAnalytics4SendManualPageViews;
        window.gtag('config', options.googleAnalyticsId, configOptions);
    }
}
//# sourceMappingURL=GA4Backend.js.map