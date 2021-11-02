var singleton;
/**
 * Used during startup by Grafana to temporarily expose the angular injector to
 * pure javascript plugins using {@link getLegacyAngularInjector}.
 *
 * @internal
 */
export var setLegacyAngularInjector = function (instance) {
    singleton = instance;
};
/**
 * WARNING: this function provides a temporary way for plugins to access anything in the
 * angular injector.  While the migration from angular to react continues, there are a few
 * options that do not yet have good alternatives.  Note that use of this function will
 * be removed in the future.
 *
 * @beta
 */
export var getLegacyAngularInjector = function () { return singleton; };
//# sourceMappingURL=legacyAngularInjector.js.map