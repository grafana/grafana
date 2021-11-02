var singletonInstance;
/**
 * Used during startup by Grafana to set the BackendSrv so it is available
 * via the {@link getBackendSrv} to the rest of the application.
 *
 * @internal
 */
export var setBackendSrv = function (instance) {
    singletonInstance = instance;
};
/**
 * Used to retrieve the {@link BackendSrv} that can be used to communicate
 * via http(s) to a remote backend such as the Grafana backend, a datasource etc.
 *
 * @public
 */
export var getBackendSrv = function () { return singletonInstance; };
//# sourceMappingURL=backendSrv.js.map