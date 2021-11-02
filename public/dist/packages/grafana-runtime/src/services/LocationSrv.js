var singletonInstance;
/**
 * Used during startup by Grafana to set the LocationSrv so it is available
 * via the {@link getLocationSrv} to the rest of the application.
 *
 * @internal
 */
export function setLocationSrv(instance) {
    singletonInstance = instance;
}
/**
 * Used to retrieve the {@link LocationSrv} that can be used to automatically navigate
 * the user to a new place in Grafana.
 *
 * @public
 */
export function getLocationSrv() {
    return singletonInstance;
}
//# sourceMappingURL=LocationSrv.js.map