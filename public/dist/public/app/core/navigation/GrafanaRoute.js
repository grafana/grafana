import { __assign, __extends, __values } from "tslib";
import React from 'react';
// @ts-ignore
import Drop from 'tether-drop';
import { locationSearchToObject, navigationLogger, reportPageview } from '@grafana/runtime';
import { keybindingSrv } from '../services/keybindingSrv';
var GrafanaRoute = /** @class */ (function (_super) {
    __extends(GrafanaRoute, _super);
    function GrafanaRoute() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    GrafanaRoute.prototype.componentDidMount = function () {
        this.updateBodyClassNames();
        this.cleanupDOM();
        // unbinds all and re-bind global keybindins
        keybindingSrv.reset();
        keybindingSrv.initGlobals();
        reportPageview();
        navigationLogger('GrafanaRoute', false, 'Mounted', this.props.match);
    };
    GrafanaRoute.prototype.componentDidUpdate = function (prevProps) {
        this.cleanupDOM();
        reportPageview();
        navigationLogger('GrafanaRoute', false, 'Updated', this.props, prevProps);
    };
    GrafanaRoute.prototype.componentWillUnmount = function () {
        this.updateBodyClassNames(true);
        navigationLogger('GrafanaRoute', false, 'Unmounted', this.props.route);
    };
    GrafanaRoute.prototype.getPageClasses = function () {
        return this.props.route.pageClass ? this.props.route.pageClass.split(' ') : [];
    };
    GrafanaRoute.prototype.updateBodyClassNames = function (clear) {
        var e_1, _a;
        if (clear === void 0) { clear = false; }
        try {
            for (var _b = __values(this.getPageClasses()), _c = _b.next(); !_c.done; _c = _b.next()) {
                var cls = _c.value;
                if (clear) {
                    document.body.classList.remove(cls);
                }
                else {
                    document.body.classList.add(cls);
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
    };
    GrafanaRoute.prototype.cleanupDOM = function () {
        var e_2, _a;
        var _b, _c;
        document.body.classList.remove('sidemenu-open--xs');
        // cleanup tooltips
        var tooltipById = document.getElementById('tooltip');
        (_b = tooltipById === null || tooltipById === void 0 ? void 0 : tooltipById.parentElement) === null || _b === void 0 ? void 0 : _b.removeChild(tooltipById);
        var tooltipsByClass = document.querySelectorAll('.tooltip');
        for (var i = 0; i < tooltipsByClass.length; i++) {
            var tooltip = tooltipsByClass[i];
            (_c = tooltip.parentElement) === null || _c === void 0 ? void 0 : _c.removeChild(tooltip);
        }
        try {
            // cleanup tether-drop
            for (var _d = __values(Drop.drops), _e = _d.next(); !_e.done; _e = _d.next()) {
                var drop = _e.value;
                drop.destroy();
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
            }
            finally { if (e_2) throw e_2.error; }
        }
    };
    GrafanaRoute.prototype.render = function () {
        var props = this.props;
        navigationLogger('GrafanaRoute', false, 'Rendered', props.route);
        var RouteComponent = props.route.component;
        return React.createElement(RouteComponent, __assign({}, props, { queryParams: locationSearchToObject(props.location.search) }));
    };
    return GrafanaRoute;
}(React.Component));
export { GrafanaRoute };
//# sourceMappingURL=GrafanaRoute.js.map