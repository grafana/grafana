/**
 * Called when upgrading from a previously saved versoin
 */
export var graphPanelMigrationHandler = function (panel) {
    var _a;
    var fieldConfig = (_a = panel.fieldConfig) !== null && _a !== void 0 ? _a : {
        defaults: {},
        overrides: [],
    };
    var options = panel.options || {};
    // Move <7.1 dataLinks to the field section
    if (options.dataLinks) {
        fieldConfig.defaults.links = options.dataLinks;
        delete options.dataLinks;
    }
    // Mutate the original panel state (only necessary because it is angular)
    panel.options = options;
    panel.fieldConfig = fieldConfig;
    return options;
};
//# sourceMappingURL=GraphMigrations.js.map