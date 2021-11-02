import { __extends, __values } from "tslib";
import { GrafanaPlugin, PluginIncludeType } from './plugin';
/**
 * @public
 * The app container that is loading another plugin (panel or query editor)
 * */
export var CoreApp;
(function (CoreApp) {
    CoreApp["CloudAlerting"] = "cloud-alerting";
    CoreApp["Dashboard"] = "dashboard";
    CoreApp["Explore"] = "explore";
    CoreApp["Unknown"] = "unknown";
    CoreApp["PanelEditor"] = "panel-editor";
    CoreApp["PanelViewer"] = "panel-viewer";
})(CoreApp || (CoreApp = {}));
var AppPlugin = /** @class */ (function (_super) {
    __extends(AppPlugin, _super);
    function AppPlugin() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * Called after the module has loaded, and before the app is used.
     * This function may be called multiple times on the same instance.
     * The first time, `this.meta` will be undefined
     */
    AppPlugin.prototype.init = function (meta) { };
    /**
     * Set the component displayed under:
     *   /a/${plugin-id}/*
     *
     * If the NavModel is configured, the page will have a managed frame, otheriwse it has full control.
     *
     * NOTE: this structure will change in 7.2+ so that it is managed with a normal react router
     */
    AppPlugin.prototype.setRootPage = function (root, rootNav) {
        this.root = root;
        this.rootNav = rootNav;
        return this;
    };
    AppPlugin.prototype.setComponentsFromLegacyExports = function (pluginExports) {
        var e_1, _a;
        if (pluginExports.ConfigCtrl) {
            this.angularConfigCtrl = pluginExports.ConfigCtrl;
        }
        if (this.meta && this.meta.includes) {
            try {
                for (var _b = __values(this.meta.includes), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var include = _c.value;
                    if (include.type === PluginIncludeType.page && include.component) {
                        var exp = pluginExports[include.component];
                        if (!exp) {
                            console.warn('App Page uses unknown component: ', include.component, this.meta);
                            continue;
                        }
                        if (!this.angularPages) {
                            this.angularPages = {};
                        }
                        this.angularPages[include.component] = exp;
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
    return AppPlugin;
}(GrafanaPlugin));
export { AppPlugin };
/**
 * Defines life cycle of a feature
 * @internal
 */
export var FeatureState;
(function (FeatureState) {
    FeatureState["alpha"] = "alpha";
    FeatureState["beta"] = "beta";
})(FeatureState || (FeatureState = {}));
//# sourceMappingURL=app.js.map