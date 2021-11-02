import { __awaiter, __extends, __generator, __makeTemplateObject, __read, __spreadArray } from "tslib";
import React, { PureComponent } from 'react';
import { css } from '@emotion/css';
import { Button, Field, FieldSet, Form, Icon, Label, RadioButtonGroup, Select, stylesFactory, TimeZonePicker, WeekStartPicker, Tooltip, } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { backendSrv } from 'app/core/services/backend_srv';
import { PreferencesService } from 'app/core/services/PreferencesService';
var themes = [
    { value: '', label: 'Default' },
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
];
var SharedPreferences = /** @class */ (function (_super) {
    __extends(SharedPreferences, _super);
    function SharedPreferences(props) {
        var _this = _super.call(this, props) || this;
        _this.onSubmitForm = function () { return __awaiter(_this, void 0, void 0, function () {
            var _a, homeDashboardId, theme, timezone, weekStart;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.state, homeDashboardId = _a.homeDashboardId, theme = _a.theme, timezone = _a.timezone, weekStart = _a.weekStart;
                        return [4 /*yield*/, this.service.update({ homeDashboardId: homeDashboardId, theme: theme, timezone: timezone, weekStart: weekStart })];
                    case 1:
                        _b.sent();
                        window.location.reload();
                        return [2 /*return*/];
                }
            });
        }); };
        _this.onThemeChanged = function (value) {
            _this.setState({ theme: value });
        };
        _this.onTimeZoneChanged = function (timezone) {
            if (!timezone) {
                return;
            }
            _this.setState({ timezone: timezone });
        };
        _this.onWeekStartChanged = function (weekStart) {
            _this.setState({ weekStart: weekStart });
        };
        _this.onHomeDashboardChanged = function (dashboardId) {
            _this.setState({ homeDashboardId: dashboardId });
        };
        _this.getFullDashName = function (dashboard) {
            if (typeof dashboard.folderTitle === 'undefined' || dashboard.folderTitle === '') {
                return dashboard.title;
            }
            return dashboard.folderTitle + ' / ' + dashboard.title;
        };
        _this.service = new PreferencesService(props.resourceUri);
        _this.state = {
            homeDashboardId: 0,
            theme: '',
            timezone: '',
            weekStart: '',
            dashboards: [],
        };
        return _this;
    }
    SharedPreferences.prototype.componentDidMount = function () {
        return __awaiter(this, void 0, void 0, function () {
            var prefs, dashboards, defaultDashboardHit, missing;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.service.load()];
                    case 1:
                        prefs = _a.sent();
                        return [4 /*yield*/, backendSrv.search({ starred: true })];
                    case 2:
                        dashboards = _a.sent();
                        defaultDashboardHit = {
                            id: 0,
                            title: 'Default',
                            tags: [],
                            type: '',
                            uid: '',
                            uri: '',
                            url: '',
                            folderId: 0,
                            folderTitle: '',
                            folderUid: '',
                            folderUrl: '',
                            isStarred: false,
                            slug: '',
                            items: [],
                        };
                        if (!(prefs.homeDashboardId > 0 && !dashboards.find(function (d) { return d.id === prefs.homeDashboardId; }))) return [3 /*break*/, 4];
                        return [4 /*yield*/, backendSrv.search({ dashboardIds: [prefs.homeDashboardId] })];
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
                            weekStart: prefs.weekStart,
                            dashboards: __spreadArray([defaultDashboardHit], __read(dashboards), false),
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    SharedPreferences.prototype.render = function () {
        var _this = this;
        var _a = this.state, theme = _a.theme, timezone = _a.timezone, weekStart = _a.weekStart, homeDashboardId = _a.homeDashboardId, dashboards = _a.dashboards;
        var styles = getStyles();
        return (React.createElement(Form, { onSubmit: this.onSubmitForm }, function () {
            var _a;
            return (React.createElement(FieldSet, { label: "Preferences" },
                React.createElement(Field, { label: "UI Theme" },
                    React.createElement(RadioButtonGroup, { options: themes, value: (_a = themes.find(function (item) { return item.value === theme; })) === null || _a === void 0 ? void 0 : _a.value, onChange: _this.onThemeChanged })),
                React.createElement(Field, { label: React.createElement(Label, { htmlFor: "home-dashboard-select" },
                        React.createElement("span", { className: styles.labelText }, "Home Dashboard"),
                        React.createElement(Tooltip, { content: "Not finding the dashboard you want? Star it first, then it should appear in this select box." },
                            React.createElement(Icon, { name: "info-circle" }))), "aria-label": "User preferences home dashboard drop down" },
                    React.createElement(Select, { menuShouldPortal: true, value: dashboards.find(function (dashboard) { return dashboard.id === homeDashboardId; }), getOptionValue: function (i) { return i.id; }, getOptionLabel: _this.getFullDashName, onChange: function (dashboard) {
                            return _this.onHomeDashboardChanged(dashboard.id);
                        }, options: dashboards, placeholder: "Choose default dashboard", inputId: "home-dashboard-select" })),
                React.createElement(Field, { label: "Timezone", "aria-label": selectors.components.TimeZonePicker.container },
                    React.createElement(TimeZonePicker, { includeInternal: true, value: timezone, onChange: _this.onTimeZoneChanged })),
                React.createElement(Field, { label: "Week start", "aria-label": selectors.components.WeekStartPicker.container },
                    React.createElement(WeekStartPicker, { value: weekStart, onChange: _this.onWeekStartChanged })),
                React.createElement("div", { className: "gf-form-button-row" },
                    React.createElement(Button, { variant: "primary", "aria-label": "User preferences save button" }, "Save"))));
        }));
    };
    return SharedPreferences;
}(PureComponent));
export { SharedPreferences };
export default SharedPreferences;
var getStyles = stylesFactory(function () {
    return {
        labelText: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-right: 6px;\n    "], ["\n      margin-right: 6px;\n    "]))),
    };
});
var templateObject_1;
//# sourceMappingURL=SharedPreferences.js.map