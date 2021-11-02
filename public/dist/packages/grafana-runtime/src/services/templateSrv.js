var singletonInstance;
/**
 * Used during startup by Grafana to set the TemplateSrv so it is available
 * via the {@link getTemplateSrv} to the rest of the application.
 *
 * @internal
 */
export var setTemplateSrv = function (instance) {
    singletonInstance = instance;
};
/**
 * Used to retrieve the {@link TemplateSrv} that can be used to fetch available
 * template variables.
 *
 * @public
 */
export var getTemplateSrv = function () { return singletonInstance; };
//# sourceMappingURL=templateSrv.js.map