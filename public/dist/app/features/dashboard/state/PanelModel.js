import * as tslib_1 from "tslib";
// Libraries
import _ from 'lodash';
// Types
import { Emitter } from 'app/core/utils/emitter';
var notPersistedProperties = {
    events: true,
    fullscreen: true,
    isEditing: true,
    hasRefreshed: true,
    cachedPluginOptions: true,
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
};
var defaults = {
    gridPos: { x: 0, y: 0, h: 3, w: 6 },
    datasource: null,
    targets: [{ refId: 'A' }],
    cachedPluginOptions: {},
    transparent: false,
};
var PanelModel = /** @class */ (function () {
    function PanelModel(model) {
        this.events = new Emitter();
        // copy properties from persisted model
        for (var property in model) {
            this[property] = model[property];
        }
        // defaults
        _.defaultsDeep(this, _.cloneDeep(defaults));
        // queries must have refId
        this.ensureQueryIds();
        this.restoreInfintyForThresholds();
    }
    PanelModel.prototype.ensureQueryIds = function () {
        var e_1, _a;
        if (this.targets) {
            try {
                for (var _b = tslib_1.__values(this.targets), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var query = _c.value;
                    if (!query.refId) {
                        query.refId = this.getNextQueryLetter();
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
    PanelModel.prototype.restoreInfintyForThresholds = function () {
        if (this.options && this.options.thresholds) {
            this.options.thresholds = this.options.thresholds.map(function (threshold) {
                // JSON serialization of -Infinity is 'null' so lets convert it back to -Infinity
                if (threshold.index === 0 && threshold.value === null) {
                    return tslib_1.__assign({}, threshold, { value: -Infinity });
                }
                return threshold;
            });
        }
    };
    PanelModel.prototype.getOptions = function (panelDefaults) {
        return _.defaultsDeep(this.options || {}, panelDefaults);
    };
    PanelModel.prototype.updateOptions = function (options) {
        this.options = options;
        this.render();
    };
    PanelModel.prototype.getSaveModel = function () {
        var model = {};
        for (var property in this) {
            if (notPersistedProperties[property] || !this.hasOwnProperty(property)) {
                continue;
            }
            if (_.isEqual(this[property], defaults[property])) {
                continue;
            }
            model[property] = _.cloneDeep(this[property]);
        }
        return model;
    };
    PanelModel.prototype.setViewMode = function (fullscreen, isEditing) {
        this.fullscreen = fullscreen;
        this.isEditing = isEditing;
        this.events.emit('view-mode-changed');
    };
    PanelModel.prototype.updateGridPos = function (newPos) {
        var sizeChanged = false;
        if (this.gridPos.w !== newPos.w || this.gridPos.h !== newPos.h) {
            sizeChanged = true;
        }
        this.gridPos.x = newPos.x;
        this.gridPos.y = newPos.y;
        this.gridPos.w = newPos.w;
        this.gridPos.h = newPos.h;
        if (sizeChanged) {
            this.events.emit('panel-size-changed');
        }
    };
    PanelModel.prototype.resizeDone = function () {
        this.events.emit('panel-size-changed');
    };
    PanelModel.prototype.refresh = function () {
        this.hasRefreshed = true;
        this.events.emit('refresh');
    };
    PanelModel.prototype.render = function () {
        if (!this.hasRefreshed) {
            this.refresh();
        }
        else {
            this.events.emit('render');
        }
    };
    PanelModel.prototype.initialized = function () {
        this.events.emit('panel-initialized');
    };
    PanelModel.prototype.getOptionsToRemember = function () {
        var _this = this;
        return Object.keys(this).reduce(function (acc, property) {
            var _a;
            if (notPersistedProperties[property] || mustKeepProps[property]) {
                return acc;
            }
            return tslib_1.__assign({}, acc, (_a = {}, _a[property] = _this[property], _a));
        }, {});
    };
    PanelModel.prototype.restorePanelOptions = function (pluginId) {
        var _this = this;
        var prevOptions = this.cachedPluginOptions[pluginId] || {};
        Object.keys(prevOptions).map(function (property) {
            _this[property] = prevOptions[property];
        });
    };
    PanelModel.prototype.changeType = function (pluginId, hook) {
        var e_2, _a;
        var oldOptions = this.getOptionsToRemember();
        var oldPluginId = this.type;
        this.type = pluginId;
        try {
            // remove panel type specific  options
            for (var _b = tslib_1.__values(_.keys(this)), _c = _b.next(); !_c.done; _c = _b.next()) {
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
        this.cachedPluginOptions[oldPluginId] = oldOptions;
        this.restorePanelOptions(pluginId);
        // Callback that can validate and migrate any existing settings
        if (hook) {
            this.options = this.options || {};
            var old = oldOptions ? oldOptions.options : null;
            Object.assign(this.options, hook(this.options, oldPluginId, old));
        }
    };
    PanelModel.prototype.addQuery = function (query) {
        query = query || { refId: 'A' };
        query.refId = this.getNextQueryLetter();
        this.targets.push(query);
    };
    PanelModel.prototype.getNextQueryLetter = function () {
        var _this = this;
        var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        return _.find(letters, function (refId) {
            return _.every(_this.targets, function (other) {
                return other.refId !== refId;
            });
        });
    };
    PanelModel.prototype.changeQuery = function (query, index) {
        // ensure refId is maintained
        query.refId = this.targets[index].refId;
        // update query in array
        this.targets = this.targets.map(function (item, itemIndex) {
            if (itemIndex === index) {
                return query;
            }
            return item;
        });
    };
    PanelModel.prototype.destroy = function () {
        this.events.emit('panel-teardown');
        this.events.removeAllListeners();
    };
    return PanelModel;
}());
export { PanelModel };
//# sourceMappingURL=PanelModel.js.map