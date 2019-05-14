import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { FormLabel, Select } from '@grafana/ui';
import { getBackendSrv } from 'app/core/services/backend_srv';
var themes = [{ value: '', label: 'Default' }, { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }];
var timezones = [
    { value: '', label: 'Default' },
    { value: 'browser', label: 'Local browser time' },
    { value: 'utc', label: 'UTC' },
];
var SharedPreferences = /** @class */ (function (_super) {
    tslib_1.__extends(SharedPreferences, _super);
    function SharedPreferences(props) {
        var _this = _super.call(this, props) || this;
        _this.backendSrv = getBackendSrv();
        _this.onSubmitForm = function (event) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var _a, homeDashboardId, theme, timezone;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        event.preventDefault();
                        _a = this.state, homeDashboardId = _a.homeDashboardId, theme = _a.theme, timezone = _a.timezone;
                        return [4 /*yield*/, this.backendSrv.put("/api/" + this.props.resourceUri + "/preferences", {
                                homeDashboardId: homeDashboardId,
                                theme: theme,
                                timezone: timezone,
                            })];
                    case 1:
                        _b.sent();
                        window.location.reload();
                        return [2 /*return*/];
                }
            });
        }); };
        _this.onThemeChanged = function (theme) {
            _this.setState({ theme: theme });
        };
        _this.onTimeZoneChanged = function (timezone) {
            _this.setState({ timezone: timezone });
        };
        _this.onHomeDashboardChanged = function (dashboardId) {
            _this.setState({ homeDashboardId: dashboardId });
        };
        _this.state = {
            homeDashboardId: 0,
            theme: '',
            timezone: '',
            dashboards: [],
        };
        return _this;
    }
    SharedPreferences.prototype.componentDidMount = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var prefs, dashboards, missing;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.backendSrv.get("/api/" + this.props.resourceUri + "/preferences")];
                    case 1:
                        prefs = _a.sent();
                        return [4 /*yield*/, this.backendSrv.search({ starred: true })];
                    case 2:
                        dashboards = _a.sent();
                        if (!(prefs.homeDashboardId > 0 && !dashboards.find(function (d) { return d.id === prefs.homeDashboardId; }))) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.backendSrv.search({ dashboardIds: [prefs.homeDashboardId] })];
                    case 3:
                        missing = _a.sent();
                        if (missing && missing.length > 0) {
                            dashboards.push(missing[0]);
                        }
                        _a.label = 4;
                    case 4:
                        this.setState({
                            homeDashboardId: prefs.homeDashboardId,
                            theme: prefs.theme,
                            timezone: prefs.timezone,
                            dashboards: tslib_1.__spread([{ id: 0, title: 'Default', tags: [], type: '', uid: '', uri: '', url: '' }], dashboards),
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    SharedPreferences.prototype.render = function () {
        var _this = this;
        var _a = this.state, theme = _a.theme, timezone = _a.timezone, homeDashboardId = _a.homeDashboardId, dashboards = _a.dashboards;
        return (React.createElement("form", { className: "section gf-form-group", onSubmit: this.onSubmitForm },
            React.createElement("h3", { className: "page-heading" }, "Preferences"),
            React.createElement("div", { className: "gf-form" },
                React.createElement("span", { className: "gf-form-label width-11" }, "UI Theme"),
                React.createElement(Select, { isSearchable: false, value: themes.find(function (item) { return item.value === theme; }), options: themes, onChange: function (theme) { return _this.onThemeChanged(theme.value); }, width: 20 })),
            React.createElement("div", { className: "gf-form" },
                React.createElement(FormLabel, { width: 11, tooltip: "Not finding dashboard you want? Star it first, then it should appear in this select box." }, "Home Dashboard"),
                React.createElement(Select, { value: dashboards.find(function (dashboard) { return dashboard.id === homeDashboardId; }), getOptionValue: function (i) { return i.id; }, getOptionLabel: function (i) { return i.title; }, onChange: function (dashboard) { return _this.onHomeDashboardChanged(dashboard.id); }, options: dashboards, placeholder: "Chose default dashboard", width: 20 })),
            React.createElement("div", { className: "gf-form" },
                React.createElement("label", { className: "gf-form-label width-11" }, "Timezone"),
                React.createElement(Select, { isSearchable: false, value: timezones.find(function (item) { return item.value === timezone; }), onChange: function (timezone) { return _this.onTimeZoneChanged(timezone.value); }, options: timezones, width: 20 })),
            React.createElement("div", { className: "gf-form-button-row" },
                React.createElement("button", { type: "submit", className: "btn btn-primary" }, "Save"))));
    };
    return SharedPreferences;
}(PureComponent));
export { SharedPreferences };
export default SharedPreferences;
//# sourceMappingURL=SharedPreferences.js.map