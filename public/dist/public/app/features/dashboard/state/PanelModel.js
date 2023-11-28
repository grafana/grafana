import { __awaiter } from "tslib";
import { cloneDeep, defaultsDeep, isArray, isEqual } from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { EventBusSrv, CoreApp, filterFieldConfigOverrides, getPanelOptionsWithDefaults, isStandardFieldProp, restoreCustomOverrideRules, } from '@grafana/data';
import { getTemplateSrv, RefreshEvent } from '@grafana/runtime';
import config from 'app/core/config';
import { safeStringifyValue } from 'app/core/utils/explore';
import { getNextRefIdChar } from 'app/core/utils/query';
import { PanelOptionsChangedEvent, PanelQueriesChangedEvent, PanelTransformationsChangedEvent, RenderEvent, } from 'app/types/events';
import { PanelQueryRunner } from '../../query/state/PanelQueryRunner';
const notPersistedProperties = {
    events: true,
    isViewing: true,
    isEditing: true,
    isInView: true,
    hasRefreshed: true,
    cachedPluginOptions: true,
    plugin: true,
    queryRunner: true,
    replaceVariables: true,
    configRev: true,
    hasSavedPanelEditChange: true,
    getDisplayTitle: true,
    dataSupport: true,
    key: true,
    isNew: true,
};
// For angular panels we need to clean up properties when changing type
// To make sure the change happens without strange bugs happening when panels use same
// named property with different type / value expectations
// This is not required for react panels
const mustKeepProps = {
    id: true,
    gridPos: true,
    type: true,
    title: true,
    scopedVars: true,
    repeat: true,
    repeatPanelId: true,
    repeatDirection: true,
    repeatedByRow: true,
    minSpan: true,
    collapsed: true,
    panels: true,
    targets: true,
    datasource: true,
    timeFrom: true,
    timeShift: true,
    hideTimeOverride: true,
    description: true,
    links: true,
    fullscreen: true,
    isEditing: true,
    hasRefreshed: true,
    events: true,
    cacheTimeout: true,
    queryCachingTTL: true,
    cachedPluginOptions: true,
    transparent: true,
    pluginVersion: true,
    queryRunner: true,
    transformations: true,
    fieldConfig: true,
    maxDataPoints: true,
    interval: true,
    replaceVariables: true,
    libraryPanel: true,
    getDisplayTitle: true,
    configRev: true,
    key: true,
};
const defaults = {
    gridPos: { x: 0, y: 0, h: 3, w: 6 },
    targets: [{ refId: 'A' }],
    cachedPluginOptions: {},
    transparent: false,
    options: {},
    fieldConfig: {
        defaults: {},
        overrides: [],
    },
    title: '',
};
export const autoMigrateAngular = {
    graph: 'timeseries',
    'table-old': 'table',
    singlestat: 'stat',
    'grafana-singlestat-panel': 'stat',
    'grafana-piechart-panel': 'piechart',
    'grafana-worldmap-panel': 'geomap',
};
const autoMigratePanelType = {
    'heatmap-new': 'heatmap', // this was a temporary development panel that is now standard
};
export class PanelModel {
    constructor(model) {
        this.datasource = null;
        // non persisted
        this.isViewing = false;
        this.isEditing = false;
        this.isInView = false;
        this.configRev = 0; // increments when configs change
        this.cachedPluginOptions = {};
        this.events = new EventBusSrv();
        this.restoreModel(model);
        this.replaceVariables = this.replaceVariables.bind(this);
        this.key = uuidv4();
    }
    /** Given a persistened PanelModel restores property values */
    restoreModel(model) {
        // Start with clean-up
        for (const property in this) {
            if (notPersistedProperties[property] || !this.hasOwnProperty(property)) {
                continue;
            }
            if (model[property]) {
                continue;
            }
            if (typeof this[property] === 'function') {
                continue;
            }
            if (typeof this[property] === 'symbol') {
                continue;
            }
            delete this[property];
        }
        // copy properties from persisted model
        for (const property in model) {
            this[property] = model[property];
        }
        const newType = autoMigratePanelType[this.type];
        if (newType) {
            this.autoMigrateFrom = this.type;
            this.type = newType;
        }
        // defaults
        defaultsDeep(this, cloneDeep(defaults));
        // queries must have refId
        this.ensureQueryIds();
    }
    generateNewKey() {
        this.key = uuidv4();
    }
    ensureQueryIds() {
        if (this.targets && isArray(this.targets)) {
            for (const query of this.targets) {
                if (!query.refId) {
                    query.refId = getNextRefIdChar(this.targets);
                }
            }
        }
    }
    getOptions() {
        return this.options;
    }
    get hasChanged() {
        return this.configRev > 0;
    }
    updateOptions(options) {
        this.options = options;
        this.configRev++;
        this.events.publish(new PanelOptionsChangedEvent());
        this.render();
    }
    updateFieldConfig(config) {
        this.fieldConfig = config;
        this.configRev++;
        this.events.publish(new PanelOptionsChangedEvent());
        this.resendLastResult();
        this.render();
    }
    getSaveModel() {
        const model = {};
        for (const property in this) {
            if (notPersistedProperties[property] || !this.hasOwnProperty(property)) {
                continue;
            }
            if (isEqual(this[property], defaults[property])) {
                continue;
            }
            model[property] = cloneDeep(this[property]);
        }
        // clean libraryPanel from collapsed rows
        if (this.type === 'row' && this.panels && this.panels.length > 0) {
            model.panels = this.panels.map((panel) => {
                if (panel.libraryPanel) {
                    const { id, title, libraryPanel, gridPos } = panel;
                    return {
                        id,
                        title,
                        gridPos,
                        libraryPanel: {
                            uid: libraryPanel.uid,
                            name: libraryPanel.name,
                        },
                    };
                }
                return panel;
            });
        }
        return model;
    }
    setIsViewing(isViewing) {
        this.isViewing = isViewing;
    }
    updateGridPos(newPos, manuallyUpdated = true) {
        if (newPos.x === this.gridPos.x &&
            newPos.y === this.gridPos.y &&
            newPos.h === this.gridPos.h &&
            newPos.w === this.gridPos.w) {
            return;
        }
        this.gridPos.x = newPos.x;
        this.gridPos.y = newPos.y;
        this.gridPos.w = newPos.w;
        this.gridPos.h = newPos.h;
        if (manuallyUpdated) {
            this.configRev++;
        }
        // Maybe a bit heavy. Could add a "GridPosChanged" event instead?
        this.render();
    }
    runAllPanelQueries({ dashboardUID, dashboardTimezone, timeData, width }) {
        if (this.type === 'row') {
            return;
        }
        this.getQueryRunner().run({
            datasource: this.datasource,
            queries: this.targets,
            panelId: this.id,
            dashboardUID: dashboardUID,
            timezone: dashboardTimezone,
            timeRange: timeData.timeRange,
            timeInfo: timeData.timeInfo,
            maxDataPoints: this.maxDataPoints || Math.floor(width),
            minInterval: this.interval,
            scopedVars: this.scopedVars,
            cacheTimeout: this.cacheTimeout,
            queryCachingTTL: this.queryCachingTTL,
            transformations: this.transformations,
            app: this.isEditing ? CoreApp.PanelEditor : this.isViewing ? CoreApp.PanelViewer : CoreApp.Dashboard,
        });
    }
    refresh() {
        this.hasRefreshed = true;
        this.events.publish(new RefreshEvent());
    }
    render() {
        if (!this.hasRefreshed) {
            this.refresh();
        }
        else {
            this.events.publish(new RenderEvent());
        }
    }
    getOptionsToRemember() {
        return Object.keys(this).reduce((acc, property) => {
            if (notPersistedProperties[property] || mustKeepProps[property]) {
                return acc;
            }
            return Object.assign(Object.assign({}, acc), { [property]: this[property] });
        }, {});
    }
    restorePanelOptions(pluginId) {
        const prevOptions = this.cachedPluginOptions[pluginId];
        if (!prevOptions) {
            return;
        }
        Object.keys(prevOptions.properties).map((property) => {
            this[property] = prevOptions.properties[property];
        });
        this.fieldConfig = restoreCustomOverrideRules(this.fieldConfig, prevOptions.fieldConfig);
    }
    applyPluginOptionDefaults(plugin, isAfterPluginChange) {
        const options = getPanelOptionsWithDefaults({
            plugin,
            currentOptions: this.options,
            currentFieldConfig: this.fieldConfig,
            isAfterPluginChange: isAfterPluginChange,
        });
        this.fieldConfig = options.fieldConfig;
        this.options = options.options;
    }
    pluginLoaded(plugin) {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin = plugin;
            const version = getPluginVersion(plugin);
            if (this.autoMigrateFrom) {
                const wasAngular = autoMigrateAngular[this.autoMigrateFrom] != null;
                const oldOptions = this.getOptionsToRemember();
                const prevPluginId = this.autoMigrateFrom;
                const newPluginId = this.type;
                this.clearPropertiesBeforePluginChange();
                // Need to set these again as they get cleared by the above function
                this.type = newPluginId;
                this.plugin = plugin;
                this.callPanelTypeChangeHandler(plugin, prevPluginId, oldOptions, wasAngular);
            }
            if (plugin.onPanelMigration) {
                if (version !== this.pluginVersion) {
                    const newPanelOptions = plugin.onPanelMigration(this);
                    this.options = yield newPanelOptions;
                    this.pluginVersion = version;
                }
            }
            this.applyPluginOptionDefaults(plugin, false);
            this.resendLastResult();
        });
    }
    clearPropertiesBeforePluginChange() {
        // remove panel type specific  options
        for (const key in this) {
            if (mustKeepProps[key]) {
                continue;
            }
            delete this[key];
        }
        this.options = {};
        // clear custom options
        this.fieldConfig = {
            defaults: Object.assign(Object.assign({}, this.fieldConfig.defaults), { custom: {} }),
            // filter out custom overrides
            overrides: filterFieldConfigOverrides(this.fieldConfig.overrides, isStandardFieldProp),
        };
    }
    // Let panel plugins inspect options from previous panel and keep any that it can use
    callPanelTypeChangeHandler(newPlugin, oldPluginId, oldOptions, wasAngular) {
        if (newPlugin.onPanelTypeChanged) {
            const prevOptions = wasAngular ? { angular: oldOptions } : oldOptions.options;
            Object.assign(this.options, newPlugin.onPanelTypeChanged(this, oldPluginId, prevOptions, this.fieldConfig));
        }
    }
    changePlugin(newPlugin) {
        const pluginId = newPlugin.meta.id;
        const oldOptions = this.getOptionsToRemember();
        const prevFieldConfig = this.fieldConfig;
        const oldPluginId = this.type;
        const wasAngular = this.isAngularPlugin() || Boolean(autoMigrateAngular[oldPluginId]);
        this.cachedPluginOptions[oldPluginId] = {
            properties: oldOptions,
            fieldConfig: prevFieldConfig,
        };
        this.clearPropertiesBeforePluginChange();
        this.restorePanelOptions(pluginId);
        // Potentially modify current options
        this.callPanelTypeChangeHandler(newPlugin, oldPluginId, oldOptions, wasAngular);
        // switch
        this.type = pluginId;
        this.plugin = newPlugin;
        this.configRev++;
        this.applyPluginOptionDefaults(newPlugin, true);
        if (newPlugin.onPanelMigration) {
            this.pluginVersion = getPluginVersion(newPlugin);
        }
    }
    updateQueries(options) {
        var _a, _b, _c;
        const { dataSource } = options;
        this.datasource = {
            uid: dataSource.uid,
            type: dataSource.type,
        };
        this.cacheTimeout = options.cacheTimeout;
        this.queryCachingTTL = options.queryCachingTTL;
        this.timeFrom = (_a = options.timeRange) === null || _a === void 0 ? void 0 : _a.from;
        this.timeShift = (_b = options.timeRange) === null || _b === void 0 ? void 0 : _b.shift;
        this.hideTimeOverride = (_c = options.timeRange) === null || _c === void 0 ? void 0 : _c.hide;
        this.interval = options.minInterval;
        this.maxDataPoints = options.maxDataPoints;
        this.targets = options.queries;
        this.configRev++;
        this.events.publish(new PanelQueriesChangedEvent());
    }
    addQuery(query) {
        query = query || { refId: 'A' };
        query.refId = getNextRefIdChar(this.targets);
        this.targets.push(query);
        this.configRev++;
    }
    changeQuery(query, index) {
        // ensure refId is maintained
        query.refId = this.targets[index].refId;
        this.configRev++;
        // update query in array
        this.targets = this.targets.map((item, itemIndex) => {
            if (itemIndex === index) {
                return query;
            }
            return item;
        });
    }
    getEditClone() {
        const sourceModel = this.getSaveModel();
        const clone = new PanelModel(sourceModel);
        clone.isEditing = true;
        clone.plugin = this.plugin;
        const sourceQueryRunner = this.getQueryRunner();
        // Copy last query result
        clone.getQueryRunner().useLastResultFrom(sourceQueryRunner);
        return clone;
    }
    getTransformations() {
        return this.transformations;
    }
    getFieldOverrideOptions() {
        if (!this.plugin) {
            return undefined;
        }
        return {
            fieldConfig: this.fieldConfig,
            replaceVariables: this.replaceVariables,
            fieldConfigRegistry: this.plugin.fieldConfigRegistry,
            theme: config.theme2,
        };
    }
    getDataSupport() {
        var _a, _b;
        return (_b = (_a = this.plugin) === null || _a === void 0 ? void 0 : _a.dataSupport) !== null && _b !== void 0 ? _b : { annotations: false, alertStates: false };
    }
    getQueryRunner() {
        if (!this.queryRunner) {
            this.queryRunner = new PanelQueryRunner(this);
        }
        return this.queryRunner;
    }
    hasTitle() {
        return this.title && this.title.length > 0;
    }
    isAngularPlugin() {
        var _a, _b, _c;
        return (this.plugin && this.plugin.angularPanelCtrl) !== undefined || ((_c = (_b = (_a = this.plugin) === null || _a === void 0 ? void 0 : _a.meta) === null || _b === void 0 ? void 0 : _b.angularDetected) !== null && _c !== void 0 ? _c : false);
    }
    destroy() {
        this.events.removeAllListeners();
        if (this.queryRunner) {
            this.queryRunner.destroy();
        }
    }
    setTransformations(transformations) {
        this.transformations = transformations;
        this.resendLastResult();
        this.configRev++;
        this.events.publish(new PanelTransformationsChangedEvent());
    }
    setProperty(key, value) {
        this[key] = value;
        this.configRev++;
        // Custom handling of repeat dependent options, handled here as PanelEditor can
        // update one key at a time right now
        if (key === 'repeat') {
            if (this.repeat && !this.repeatDirection) {
                this.repeatDirection = 'h';
            }
            else if (!this.repeat) {
                delete this.repeatDirection;
                delete this.maxPerRow;
            }
        }
    }
    replaceVariables(value, extraVars, format) {
        const lastRequest = this.getQueryRunner().getLastRequest();
        const vars = Object.assign({}, this.scopedVars, lastRequest === null || lastRequest === void 0 ? void 0 : lastRequest.scopedVars, extraVars);
        return getTemplateSrv().replace(value, vars, format);
    }
    resendLastResult() {
        if (!this.plugin) {
            return;
        }
        this.getQueryRunner().resendLastResult();
    }
    /*
     * This is the title used when displaying the title in the UI so it will include any interpolated variables.
     * If you need the raw title without interpolation use title property instead.
     * */
    getDisplayTitle() {
        return this.replaceVariables(this.title, undefined, 'text');
    }
    initLibraryPanel(libPanel) {
        for (const [key, val] of Object.entries(libPanel.model)) {
            switch (key) {
                case 'id':
                case 'gridPos':
                case 'libraryPanel': // recursive?
                    continue;
            }
            this[key] = val; // :grimmice:
        }
        this.libraryPanel = libPanel;
    }
    unlinkLibraryPanel() {
        delete this.libraryPanel;
        this.configRev++;
        this.render();
    }
}
function getPluginVersion(plugin) {
    return plugin && plugin.meta.info.version ? plugin.meta.info.version : config.buildInfo.version;
}
// For cases where we immediately want to stringify the panel model without cloning each property
export function stringifyPanelModel(panel) {
    const model = {};
    Object.entries(panel)
        .filter(([prop, val]) => !notPersistedProperties[prop] && panel.hasOwnProperty(prop) && !isEqual(val, defaults[prop]))
        .forEach(([k, v]) => {
        model[k] = v;
    });
    return safeStringifyValue(model);
}
//# sourceMappingURL=PanelModel.js.map