import { EchoEventType, isExperimentViewEvent, isInteractionEvent, isPageviewEvent, } from '@grafana/runtime';
import { loadScript } from '../../utils';
export class RudderstackBackend {
    constructor(options) {
        var _a, _b, _c, _d;
        this.options = options;
        this.supportedEvents = [EchoEventType.Pageview, EchoEventType.Interaction, EchoEventType.ExperimentView];
        this.addEvent = (e) => {
            var _a, _b, _c, _d, _e, _f;
            if (!window.rudderanalytics) {
                return;
            }
            if (isPageviewEvent(e)) {
                (_b = (_a = window.rudderanalytics).page) === null || _b === void 0 ? void 0 : _b.call(_a);
            }
            if (isInteractionEvent(e)) {
                (_d = (_c = window.rudderanalytics).track) === null || _d === void 0 ? void 0 : _d.call(_c, e.payload.interactionName, e.payload.properties);
            }
            if (isExperimentViewEvent(e)) {
                (_f = (_e = window.rudderanalytics).track) === null || _f === void 0 ? void 0 : _f.call(_e, 'experiment_viewed', {
                    experiment_id: e.payload.experimentId,
                    experiment_group: e.payload.experimentGroup,
                    experiment_variant: e.payload.experimentVariant,
                });
            }
        };
        // Not using Echo buffering, addEvent above sends events to GA as soon as they appear
        this.flush = () => { };
        const url = options.sdkUrl || `https://cdn.rudderlabs.com/v1/rudder-analytics.min.js`;
        loadScript(url);
        const tempRudderstack = (window.rudderanalytics = []);
        const methods = [
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
        for (let i = 0; i < methods.length; i++) {
            const method = methods[i];
            tempRudderstack[method] = (function (methodName) {
                return function () {
                    // @ts-ignore
                    tempRudderstack.push([methodName].concat(Array.prototype.slice.call(arguments)));
                };
            })(method);
        }
        (_b = (_a = window.rudderanalytics) === null || _a === void 0 ? void 0 : _a.load) === null || _b === void 0 ? void 0 : _b.call(_a, options.writeKey, options.dataPlaneUrl, { configUrl: options.configUrl });
        if (options.user) {
            const { identifier, intercomIdentifier } = options.user.analytics;
            const apiOptions = {};
            if (intercomIdentifier) {
                apiOptions.Intercom = {
                    user_hash: intercomIdentifier,
                };
            }
            (_d = (_c = window.rudderanalytics) === null || _c === void 0 ? void 0 : _c.identify) === null || _d === void 0 ? void 0 : _d.call(_c, identifier, {
                email: options.user.email,
                orgId: options.user.orgId,
                language: options.user.language,
                version: options.buildInfo.version,
                edition: options.buildInfo.edition,
            }, apiOptions);
        }
    }
}
//# sourceMappingURL=RudderstackBackend.js.map