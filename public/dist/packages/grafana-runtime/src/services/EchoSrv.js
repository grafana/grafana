/**
 * Supported echo event types that can be sent via the {@link EchoSrv}.
 *
 * @public
 */
export var EchoEventType;
(function (EchoEventType) {
    EchoEventType["Performance"] = "performance";
    EchoEventType["MetaAnalytics"] = "meta-analytics";
    EchoEventType["Sentry"] = "sentry";
    EchoEventType["Pageview"] = "pageview";
    EchoEventType["Interaction"] = "interaction";
})(EchoEventType || (EchoEventType = {}));
var singletonInstance;
/**
 * Used during startup by Grafana to set the EchoSrv so it is available
 * via the {@link getEchoSrv} to the rest of the application.
 *
 * @internal
 */
export function setEchoSrv(instance) {
    singletonInstance = instance;
}
/**
 * Used to retrieve the {@link EchoSrv} that can be used to report events to registered
 * echo backends.
 *
 * @public
 */
export function getEchoSrv() {
    return singletonInstance;
}
/**
 * Used to register echo backends that will receive Grafana echo events during application
 * runtime.
 *
 * @public
 */
export var registerEchoBackend = function (backend) {
    getEchoSrv().addBackend(backend);
};
//# sourceMappingURL=EchoSrv.js.map