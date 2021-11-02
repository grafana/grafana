import { getEchoSrv, EchoEventType } from '../services/EchoSrv';
import { locationService } from '../services';
import { config } from '../config';
/**
 * Helper function to report meta analytics to the {@link EchoSrv}.
 *
 * @public
 */
export var reportMetaAnalytics = function (payload) {
    getEchoSrv().addEvent({
        type: EchoEventType.MetaAnalytics,
        payload: payload,
    });
};
/**
 * Helper function to report pageview events to the {@link EchoSrv}.
 *
 * @public
 */
export var reportPageview = function () {
    var _a;
    var location = locationService.getLocation();
    var page = "" + ((_a = config.appSubUrl) !== null && _a !== void 0 ? _a : '') + location.pathname + location.search + location.hash;
    getEchoSrv().addEvent({
        type: EchoEventType.Pageview,
        payload: {
            page: page,
        },
    });
};
/**
 * Helper function to report interaction events to the {@link EchoSrv}.
 *
 * @public
 */
export var reportInteraction = function (interactionName, properties) {
    getEchoSrv().addEvent({
        type: EchoEventType.Interaction,
        payload: {
            interactionName: interactionName,
            properties: properties,
        },
    });
};
//# sourceMappingURL=analytics.js.map