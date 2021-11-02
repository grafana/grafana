var singletonInstance;
/**
 * Used during startup by Grafana to set the GrafanaLiveSrv so it is available
 * via the {@link getGrafanaLiveSrv} to the rest of the application.
 *
 * @internal
 */
export var setGrafanaLiveSrv = function (instance) {
    singletonInstance = instance;
};
/**
 * Used to retrieve the GrafanaLiveSrv that allows you to subscribe to
 * server side events and streams
 *
 * @alpha -- experimental
 */
export var getGrafanaLiveSrv = function () { return singletonInstance; };
//# sourceMappingURL=live.js.map