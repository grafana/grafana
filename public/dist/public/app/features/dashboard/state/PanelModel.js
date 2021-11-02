import { __assign, __values } from "tslib";
// Libraries
import { cloneDeep, defaultsDeep, isArray, isEqual, keys } from 'lodash';
import { v4 as uuidv4 } from 'uuid';
// Utils
import { getTemplateSrv, RefreshEvent } from '@grafana/runtime';
import { getNextRefIdChar } from 'app/core/utils/query';
// Types
import { DataLinkBuiltInVars, EventBusSrv, urlUtil, } from '@grafana/data';
import config from 'app/core/config';
import { PanelQueryRunner } from '../../query/state/PanelQueryRunner';
import { PanelOptionsChangedEvent, PanelQueriesChangedEvent, PanelTransformationsChangedEvent, RenderEvent, } from 'app/types/events';
import { getTimeSrv } from '../services/TimeSrv';
import { getVariablesUrlParams } from '../../variables/getAllVariableValuesForUrl';
import { filterFieldConfigOverrides, getPanelOptionsWithDefaults, isStandardFieldProp, restoreCustomOverrideRules, } from './getPanelOptionsWithDefaults';
var notPersistedProperties = {
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
    getDisplayTitle: true,
    dataSupport: true,
    key: true,
};
// For angular panels we need to clean up properties when changing type
// To make sure the change happens without strange bugs happening when panels use same
// named property with different type / value expectations
// This is not required for react panels
var mustKeepProps = {
    id: true,
    gridPos: true,
    type: true,
    title: true,
    scopedVars: true,
    repeat: true,
    repeatIteration: true,
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
var defaults = {
    gridPos: { x: 0, y: 0, h: 3, w: 6 },
    targets: [{ refId: 'A' }],
    cachedPluginOptions: {},
    transparent: false,
    options: {},
    fieldConfig: {
        defaults: {},
        overrides: [],
    },
    datasource: null,
    title: '',
};
var PanelModel = /** @class */ (function () {
    function PanelModel(model) {
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
    PanelModel.prototype.restoreModel = function (model) {
        // Start with clean-up
        for (var property in this) {
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
        for (var property in model) {
            this[property] = model[property];
        }
        // defaults
        defaultsDeep(this, cloneDeep(defaults));
        // queries must have refId
        this.ensureQueryIds();
    };
    PanelModel.prototype.generateNewKey = function () {
        this.key = uuidv4();
    };
    PanelModel.prototype.ensureQueryIds = function () {
        var e_1, _a;
        if (this.targets && isArray(this.targets)) {
            try {
                for (var _b = __values(this.targets), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var query = _c.value;
                    if (!query.refId) {
                        query.refId = getNextRefIdChar(this.targets);
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
    };
    PanelModel.prototype.getOptions = function () {
        return this.options;
    };
    Object.defineProperty(PanelModel.prototype, "hasChanged", {
        get: function () {
            return this.configRev > 0;
        },
        enumerable: false,
        configurable: true
    });
    PanelModel.prototype.updateOptions = function (options) {
        this.options = options;
        this.configRev++;
        this.events.publish(new PanelOptionsChangedEvent());
        this.render();
    };
    PanelModel.prototype.updateFieldConfig = function (config) {
        this.fieldConfig = config;
        this.configRev++;
        this.events.publish(new PanelOptionsChangedEvent());
        this.resendLastResult();
        this.render();
    };
    PanelModel.prototype.getSaveModel = function () {
        var model = {};
        for (var property in this) {
            if (notPersistedProperties[property] || !this.hasOwnProperty(property)) {
                continue;
            }
            if (isEqual(this[property], defaults[property])) {
                continue;
            }
            model[property] = cloneDeep(this[property]);
        }
        if (model.datasource === undefined) {
            // This is part of defaults as defaults are removed in save model and
            // this should not be removed in save model as exporter needs to templatize it
            model.datasource = null;
        }
        return model;
    };
    PanelModel.prototype.setIsViewing = function (isViewing) {
        this.isViewing = isViewing;
    };
    PanelModel.prototype.updateGridPos = function (newPos) {
        this.gridPos.x = newPos.x;
        this.gridPos.y = newPos.y;
        this.gridPos.w = newPos.w;
        this.gridPos.h = newPos.h;
    };
    PanelModel.prototype.runAllPanelQueries = function (dashboardId, dashboardTimezone, timeData, width) {
        this.getQueryRunner().run({
            datasource: this.datasource,
            queries: this.targets,
            panelId: this.id,
            dashboardId: dashboardId,
            timezone: dashboardTimezone,
            timeRange: timeData.timeRange,
            timeInfo: timeData.timeInfo,
            maxDataPoints: this.maxDataPoints || width,
            minInterval: this.interval,
            scopedVars: this.scopedVars,
            cacheTimeout: this.cacheTimeout,
            transformations: this.transformations,
        });
    };
    PanelModel.prototype.refresh = function () {
        this.hasRefreshed = true;
        this.events.publish(new RefreshEvent());
    };
    PanelModel.prototype.render = function () {
        if (!this.hasRefreshed) {
            this.refresh();
        }
        else {
            this.events.publish(new RenderEvent());
        }
    };
    PanelModel.prototype.getOptionsToRemember = function () {
        var _this = this;
        return Object.keys(this).reduce(function (acc, property) {
            var _a;
            if (notPersistedProperties[property] || mustKeepProps[property]) {
                return acc;
            }
            return __assign(__assign({}, acc), (_a = {}, _a[property] = _this[property], _a));
        }, {});
    };
    PanelModel.prototype.restorePanelOptions = function (pluginId) {
        var _this = this;
        var prevOptions = this.cachedPluginOptions[pluginId];
        if (!prevOptions) {
            return;
        }
        Object.keys(prevOptions.properties).map(function (property) {
            _this[property] = prevOptions.properties[property];
        });
        this.fieldConfig = restoreCustomOverrideRules(this.fieldConfig, prevOptions.fieldConfig);
    };
    PanelModel.prototype.applyPluginOptionDefaults = function (plugin, isAfterPluginChange) {
        var options = getPanelOptionsWithDefaults({
            plugin: plugin,
            currentOptions: this.options,
            currentFieldConfig: this.fieldConfig,
            isAfterPluginChange: isAfterPluginChange,
        });
        this.fieldConfig = options.fieldConfig;
        this.options = options.options;
    };
    PanelModel.prototype.pluginLoaded = function (plugin) {
        this.plugin = plugin;
        var version = getPluginVersion(plugin);
        if (plugin.onPanelMigration) {
            if (version !== this.pluginVersion) {
                this.options = plugin.onPanelMigration(this);
                this.pluginVersion = version;
            }
        }
        this.applyPluginOptionDefaults(plugin, false);
        this.resendLastResult();
    };
    PanelModel.prototype.clearPropertiesBeforePluginChange = function () {
        var e_2, _a;
        try {
            // remove panel type specific  options
            for (var _b = __values(keys(this)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var key = _c.value;
                if (mustKeepProps[key]) {
                    continue;
                }
                delete this[key];
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
        this.options = {};
        // clear custom options
        this.fieldConfig = {
            defaults: __assign(__assign({}, this.fieldConfig.defaults), { custom: {} }),
            // filter out custom overrides
            overrides: filterFieldConfigOverrides(this.fieldConfig.overrides, isStandardFieldProp),
        };
    };
    PanelModel.prototype.changePlugin = function (newPlugin) {
        var pluginId = newPlugin.meta.id;
        var oldOptions = this.getOptionsToRemember();
        var prevFieldConfig = this.fieldConfig;
        var oldPluginId = this.type;
        var wasAngular = this.isAngularPlugin();
        this.cachedPluginOptions[oldPluginId] = {
            properties: oldOptions,
            fieldConfig: prevFieldConfig,
        };
        this.clearPropertiesBeforePluginChange();
        this.restorePanelOptions(pluginId);
        // Let panel plugins inspect options from previous panel and keep any that it can use
        if (newPlugin.onPanelTypeChanged) {
            var prevOptions = wasAngular ? { angular: oldOptions } : oldOptions.options;
            Object.assign(this.options, newPlugin.onPanelTypeChanged(this, oldPluginId, prevOptions, prevFieldConfig));
        }
        // switch
        this.type = pluginId;
        this.plugin = newPlugin;
        this.configRev++;
        this.applyPluginOptionDefaults(newPlugin, true);
        if (newPlugin.onPanelMigration) {
            this.pluginVersion = getPluginVersion(newPlugin);
        }
    };
    PanelModel.prototype.updateQueries = function (options) {
        var _a, _b, _c;
        var dataSource = options.dataSource;
        this.datasource = dataSource.default
            ? null
            : {
                uid: dataSource.uid,
                type: dataSource.type,
            };
        this.timeFrom = (_a = options.timeRange) === null || _a === void 0 ? void 0 : _a.from;
        this.timeShift = (_b = options.timeRange) === null || _b === void 0 ? void 0 : _b.shift;
        this.hideTimeOverride = (_c = options.timeRange) === null || _c === void 0 ? void 0 : _c.hide;
        this.interval = options.minInterval;
        this.maxDataPoints = options.maxDataPoints;
        this.targets = options.queries;
        this.configRev++;
        this.events.publish(new PanelQueriesChangedEvent());
    };
    PanelModel.prototype.addQuery = function (query) {
        query = query || { refId: 'A' };
        query.refId = getNextRefIdChar(this.targets);
        this.targets.push(query);
        this.configRev++;
    };
    PanelModel.prototype.changeQuery = function (query, index) {
        // ensure refId is maintained
        query.refId = this.targets[index].refId;
        this.configRev++;
        // update query in array
        this.targets = this.targets.map(function (item, itemIndex) {
            if (itemIndex === index) {
                return query;
            }
            return item;
        });
    };
    PanelModel.prototype.getEditClone = function () {
        var sourceModel = this.getSaveModel();
        var clone = new PanelModel(sourceModel);
        clone.isEditing = true;
        var sourceQueryRunner = this.getQueryRunner();
        // Copy last query result
        clone.getQueryRunner().useLastResultFrom(sourceQueryRunner);
        return clone;
    };
    PanelModel.prototype.getTransformations = function () {
        return this.transformations;
    };
    PanelModel.prototype.getFieldOverrideOptions = function () {
        if (!this.plugin) {
            return undefined;
        }
        return {
            fieldConfig: this.fieldConfig,
            replaceVariables: this.replaceVariables,
            fieldConfigRegistry: this.plugin.fieldConfigRegistry,
            theme: config.theme2,
        };
    };
    PanelModel.prototype.getDataSupport = function () {
        var _a, _b;
        return (_b = (_a = this.plugin) === null || _a === void 0 ? void 0 : _a.dataSupport) !== null && _b !== void 0 ? _b : { annotations: false, alertStates: false };
    };
    PanelModel.prototype.getQueryRunner = function () {
        if (!this.queryRunner) {
            this.queryRunner = new PanelQueryRunner(this);
        }
        return this.queryRunner;
    };
    PanelModel.prototype.hasTitle = function () {
        return this.title && this.title.length > 0;
    };
    PanelModel.prototype.isAngularPlugin = function () {
        return (this.plugin && this.plugin.angularPanelCtrl) !== undefined;
    };
    PanelModel.prototype.destroy = function () {
        this.events.removeAllListeners();
        if (this.queryRunner) {
            this.queryRunner.destroy();
        }
    };
    PanelModel.prototype.setTransformations = function (transformations) {
        this.transformations = transformations;
        this.resendLastResult();
        this.configRev++;
        this.events.publish(new PanelTransformationsChangedEvent());
    };
    PanelModel.prototype.setProperty = function (key, value) {
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
    };
    PanelModel.prototype.replaceVariables = function (value, extraVars, format) {
        var _a;
        var vars = this.scopedVars;
        if (extraVars) {
            vars = vars ? __assign(__assign({}, vars), extraVars) : extraVars;
        }
        var allVariablesParams = getVariablesUrlParams(vars);
        var variablesQuery = urlUtil.toUrlParams(allVariablesParams);
        var timeRangeUrl = urlUtil.toUrlParams(getTimeSrv().timeRangeForUrl());
        vars = __assign(__assign({}, vars), (_a = {}, _a[DataLinkBuiltInVars.keepTime] = {
            text: timeRangeUrl,
            value: timeRangeUrl,
        }, _a[DataLinkBuiltInVars.includeVars] = {
            text: variablesQuery,
            value: variablesQuery,
        }, _a));
        return getTemplateSrv().replace(value, vars, format);
    };
    PanelModel.prototype.resendLastResult = function () {
        if (!this.plugin) {
            return;
        }
        this.getQueryRunner().resendLastResult();
    };
    /*
     * This is the title used when displaying the title in the UI so it will include any interpolated variables.
     * If you need the raw title without interpolation use title property instead.
     * */
    PanelModel.prototype.getDisplayTitle = function () {
        return this.replaceVariables(this.title, {}, 'text');
    };
    return PanelModel;
}());
export { PanelModel };
function getPluginVersion(plugin) {
    return plugin && plugin.meta.info.version ? plugin.meta.info.version : config.buildInfo.version;
}
//# sourceMappingURL=PanelModel.js.map