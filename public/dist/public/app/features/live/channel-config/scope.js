import { __awaiter, __extends, __generator, __read, __values } from "tslib";
import { LiveChannelScope } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { config } from 'app/core/config';
import { loadPlugin } from 'app/features/plugins/PluginPage';
import { LiveMeasurementsSupport } from '../measurements/measurementsSupport';
var GrafanaLiveScope = /** @class */ (function () {
    function GrafanaLiveScope(scope) {
        this.scope = scope;
    }
    return GrafanaLiveScope;
}());
export { GrafanaLiveScope };
var GrafanaLiveCoreScope = /** @class */ (function (_super) {
    __extends(GrafanaLiveCoreScope, _super);
    function GrafanaLiveCoreScope() {
        var _this = _super.call(this, LiveChannelScope.Grafana) || this;
        _this.features = new Map();
        _this.namespaces = [];
        return _this;
    }
    GrafanaLiveCoreScope.prototype.register = function (feature) {
        this.features.set(feature.name, feature.support);
        this.namespaces.push({
            value: feature.name,
            label: feature.name,
            description: feature.description,
        });
    };
    /**
     * Load the real namespaces
     */
    GrafanaLiveCoreScope.prototype.getChannelSupport = function (namespace) {
        return __awaiter(this, void 0, void 0, function () {
            var v;
            return __generator(this, function (_a) {
                v = this.features.get(namespace);
                if (v) {
                    return [2 /*return*/, Promise.resolve(v)];
                }
                throw new Error('unknown feature: ' + namespace);
            });
        });
    };
    /**
     * List the possible values within this scope
     */
    GrafanaLiveCoreScope.prototype.listNamespaces = function () {
        return Promise.resolve(this.namespaces);
    };
    return GrafanaLiveCoreScope;
}(GrafanaLiveScope));
export var grafanaLiveCoreFeatures = new GrafanaLiveCoreScope();
var GrafanaLiveDataSourceScope = /** @class */ (function (_super) {
    __extends(GrafanaLiveDataSourceScope, _super);
    function GrafanaLiveDataSourceScope() {
        return _super.call(this, LiveChannelScope.DataSource) || this;
    }
    /**
     * Load the real namespaces
     */
    GrafanaLiveDataSourceScope.prototype.getChannelSupport = function (namespace) {
        return __awaiter(this, void 0, void 0, function () {
            var ds;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getDataSourceSrv().get(namespace)];
                    case 1:
                        ds = _a.sent();
                        if (ds.channelSupport) {
                            return [2 /*return*/, ds.channelSupport];
                        }
                        return [2 /*return*/, new LiveMeasurementsSupport()]; // default support?
                }
            });
        });
    };
    /**
     * List the possible values within this scope
     */
    GrafanaLiveDataSourceScope.prototype.listNamespaces = function () {
        return __awaiter(this, void 0, void 0, function () {
            var names, _a, _b, _c, key, ds, s, err_1, e_1_1;
            var e_1, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        if (this.names) {
                            return [2 /*return*/, Promise.resolve(this.names)];
                        }
                        names = [];
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 8, 9, 10]);
                        _a = __values(Object.entries(config.datasources)), _b = _a.next();
                        _e.label = 2;
                    case 2:
                        if (!!_b.done) return [3 /*break*/, 7];
                        _c = __read(_b.value, 2), key = _c[0], ds = _c[1];
                        if (!ds.meta.live) return [3 /*break*/, 6];
                        _e.label = 3;
                    case 3:
                        _e.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.getChannelSupport(key)];
                    case 4:
                        s = _e.sent();
                        if (s) {
                            names.push({
                                label: ds.name,
                                value: ds.type,
                                description: ds.type,
                            });
                        }
                        return [3 /*break*/, 6];
                    case 5:
                        err_1 = _e.sent();
                        err_1.isHandled = true;
                        return [3 /*break*/, 6];
                    case 6:
                        _b = _a.next();
                        return [3 /*break*/, 2];
                    case 7: return [3 /*break*/, 10];
                    case 8:
                        e_1_1 = _e.sent();
                        e_1 = { error: e_1_1 };
                        return [3 /*break*/, 10];
                    case 9:
                        try {
                            if (_b && !_b.done && (_d = _a.return)) _d.call(_a);
                        }
                        finally { if (e_1) throw e_1.error; }
                        return [7 /*endfinally*/];
                    case 10: return [2 /*return*/, (this.names = names)];
                }
            });
        });
    };
    return GrafanaLiveDataSourceScope;
}(GrafanaLiveScope));
export { GrafanaLiveDataSourceScope };
var GrafanaLivePluginScope = /** @class */ (function (_super) {
    __extends(GrafanaLivePluginScope, _super);
    function GrafanaLivePluginScope() {
        return _super.call(this, LiveChannelScope.Plugin) || this;
    }
    /**
     * Load the real namespaces
     */
    GrafanaLivePluginScope.prototype.getChannelSupport = function (namespace) {
        return __awaiter(this, void 0, void 0, function () {
            var plugin;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, loadPlugin(namespace)];
                    case 1:
                        plugin = _a.sent();
                        if (!plugin) {
                            throw new Error('Unknown streaming plugin: ' + namespace);
                        }
                        if (plugin.channelSupport) {
                            return [2 /*return*/, plugin.channelSupport]; // explicit
                        }
                        throw new Error('Plugin does not support streaming: ' + namespace);
                }
            });
        });
    };
    /**
     * List the possible values within this scope
     */
    GrafanaLivePluginScope.prototype.listNamespaces = function () {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var names, _b, _c, _d, key, panel, s, err_2, e_2_1;
            var e_2, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        if (this.names) {
                            return [2 /*return*/, Promise.resolve(this.names)];
                        }
                        names = [];
                        _f.label = 1;
                    case 1:
                        _f.trys.push([1, 8, 9, 10]);
                        _b = __values(Object.entries(config.panels)), _c = _b.next();
                        _f.label = 2;
                    case 2:
                        if (!!_c.done) return [3 /*break*/, 7];
                        _d = __read(_c.value, 2), key = _d[0], panel = _d[1];
                        if (!panel.live) return [3 /*break*/, 6];
                        _f.label = 3;
                    case 3:
                        _f.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.getChannelSupport(key)];
                    case 4:
                        s = _f.sent();
                        if (s) {
                            names.push({
                                label: panel.name,
                                value: key,
                                description: (_a = panel.info) === null || _a === void 0 ? void 0 : _a.description,
                            });
                        }
                        return [3 /*break*/, 6];
                    case 5:
                        err_2 = _f.sent();
                        err_2.isHandled = true;
                        return [3 /*break*/, 6];
                    case 6:
                        _c = _b.next();
                        return [3 /*break*/, 2];
                    case 7: return [3 /*break*/, 10];
                    case 8:
                        e_2_1 = _f.sent();
                        e_2 = { error: e_2_1 };
                        return [3 /*break*/, 10];
                    case 9:
                        try {
                            if (_c && !_c.done && (_e = _b.return)) _e.call(_b);
                        }
                        finally { if (e_2) throw e_2.error; }
                        return [7 /*endfinally*/];
                    case 10: return [2 /*return*/, (this.names = names)];
                }
            });
        });
    };
    return GrafanaLivePluginScope;
}(GrafanaLiveScope));
export { GrafanaLivePluginScope };
var GrafanaLiveStreamScope = /** @class */ (function (_super) {
    __extends(GrafanaLiveStreamScope, _super);
    function GrafanaLiveStreamScope() {
        return _super.call(this, LiveChannelScope.Stream) || this;
    }
    GrafanaLiveStreamScope.prototype.getChannelSupport = function (namespace) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new LiveMeasurementsSupport()];
            });
        });
    };
    /**
     * List the possible values within this scope
     */
    GrafanaLiveStreamScope.prototype.listNamespaces = function () {
        return __awaiter(this, void 0, void 0, function () {
            var names;
            return __generator(this, function (_a) {
                if (this.names) {
                    return [2 /*return*/, Promise.resolve(this.names)];
                }
                names = [];
                // TODO!!!
                return [2 /*return*/, (this.names = names)];
            });
        });
    };
    return GrafanaLiveStreamScope;
}(GrafanaLiveScope));
export { GrafanaLiveStreamScope };
//# sourceMappingURL=scope.js.map