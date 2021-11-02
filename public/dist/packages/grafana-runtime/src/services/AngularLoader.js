var instance;
/**
 * Used during startup by Grafana to set the AngularLoader so it is available
 * via the {@link getAngularLoader} to the rest of the application.
 *
 * @internal
 */
export function setAngularLoader(v) {
    instance = v;
}
/**
 * Used to retrieve the {@link AngularLoader} that enables the use of Angular
 * components within a React component.
 *
 * Please see the {@link AngularComponent} for a proper example.
 *
 * @public
 */
export function getAngularLoader() {
    return instance;
}
//# sourceMappingURL=AngularLoader.js.map