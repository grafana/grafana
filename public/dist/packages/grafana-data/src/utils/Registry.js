import { __values } from "tslib";
import { PluginState } from '../types';
var Registry = /** @class */ (function () {
    function Registry(init) {
        var _this = this;
        this.init = init;
        this.ordered = [];
        this.byId = new Map();
        this.initialized = false;
        this.setInit = function (init) {
            if (_this.initialized) {
                throw new Error('Registry already initialized');
            }
            _this.init = init;
        };
    }
    Registry.prototype.getIfExists = function (id) {
        if (!this.initialized) {
            this.initialize();
        }
        if (id) {
            return this.byId.get(id);
        }
        return undefined;
    };
    Registry.prototype.initialize = function () {
        var e_1, _a;
        if (this.init) {
            try {
                for (var _b = __values(this.init()), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var ext = _c.value;
                    this.register(ext);
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
        this.sort();
        this.initialized = true;
    };
    Registry.prototype.get = function (id) {
        var v = this.getIfExists(id);
        if (!v) {
            throw new Error("\"" + id + "\" not found in: " + this.list().map(function (v) { return v.id; }));
        }
        return v;
    };
    Registry.prototype.selectOptions = function (current, filter) {
        var e_2, _a, e_3, _b;
        if (!this.initialized) {
            this.initialize();
        }
        var select = {
            options: [],
            current: [],
        };
        var currentOptions = {};
        if (current) {
            try {
                for (var current_1 = __values(current), current_1_1 = current_1.next(); !current_1_1.done; current_1_1 = current_1.next()) {
                    var id = current_1_1.value;
                    currentOptions[id] = {};
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (current_1_1 && !current_1_1.done && (_a = current_1.return)) _a.call(current_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
        try {
            for (var _c = __values(this.ordered), _d = _c.next(); !_d.done; _d = _c.next()) {
                var ext = _d.value;
                if (ext.excludeFromPicker) {
                    continue;
                }
                if (filter && !filter(ext)) {
                    continue;
                }
                var option = {
                    value: ext.id,
                    label: ext.name,
                    description: ext.description,
                };
                if (ext.state === PluginState.alpha) {
                    option.label += ' (alpha)';
                }
                select.options.push(option);
                if (currentOptions[ext.id]) {
                    currentOptions[ext.id] = option;
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
            }
            finally { if (e_3) throw e_3.error; }
        }
        if (current) {
            // this makes sure we preserve the order of ids
            select.current = Object.values(currentOptions);
        }
        return select;
    };
    /**
     * Return a list of values by ID, or all values if not specified
     */
    Registry.prototype.list = function (ids) {
        var e_4, _a;
        if (!this.initialized) {
            this.initialize();
        }
        if (ids) {
            var found = [];
            try {
                for (var ids_1 = __values(ids), ids_1_1 = ids_1.next(); !ids_1_1.done; ids_1_1 = ids_1.next()) {
                    var id = ids_1_1.value;
                    var v = this.getIfExists(id);
                    if (v) {
                        found.push(v);
                    }
                }
            }
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (ids_1_1 && !ids_1_1.done && (_a = ids_1.return)) _a.call(ids_1);
                }
                finally { if (e_4) throw e_4.error; }
            }
            return found;
        }
        return this.ordered;
    };
    Registry.prototype.isEmpty = function () {
        if (!this.initialized) {
            this.initialize();
        }
        return this.ordered.length === 0;
    };
    Registry.prototype.register = function (ext) {
        var e_5, _a;
        if (this.byId.has(ext.id)) {
            throw new Error('Duplicate Key:' + ext.id);
        }
        this.byId.set(ext.id, ext);
        this.ordered.push(ext);
        if (ext.aliasIds) {
            try {
                for (var _b = __values(ext.aliasIds), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var alias = _c.value;
                    if (!this.byId.has(alias)) {
                        this.byId.set(alias, ext);
                    }
                }
            }
            catch (e_5_1) { e_5 = { error: e_5_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_5) throw e_5.error; }
            }
        }
        if (this.initialized) {
            this.sort();
        }
    };
    Registry.prototype.sort = function () {
        // TODO sort the list
    };
    return Registry;
}());
export { Registry };
//# sourceMappingURL=Registry.js.map