import { __awaiter, __extends, __generator, __read } from "tslib";
import React from 'react';
import { connect } from 'react-redux';
import { getBackendSrv } from '@grafana/runtime';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
var AdminSettings = /** @class */ (function (_super) {
    __extends(AdminSettings, _super);
    function AdminSettings() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            settings: {},
            isLoading: true,
        };
        return _this;
    }
    AdminSettings.prototype.componentDidMount = function () {
        return __awaiter(this, void 0, void 0, function () {
            var settings;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getBackendSrv().get('/api/admin/settings')];
                    case 1:
                        settings = _a.sent();
                        this.setState({
                            settings: settings,
                            isLoading: false,
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    AdminSettings.prototype.render = function () {
        var _a = this.state, settings = _a.settings, isLoading = _a.isLoading;
        var navModel = this.props.navModel;
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, { isLoading: isLoading },
                React.createElement("div", { className: "grafana-info-box span8", style: { margin: '20px 0 25px 0' } }, "These system settings are defined in grafana.ini or custom.ini (or overridden in ENV variables). To change these you currently need to restart Grafana."),
                React.createElement("table", { className: "filter-table" },
                    React.createElement("tbody", null, Object.entries(settings).map(function (_a, i) {
                        var _b = __read(_a, 2), sectionName = _b[0], sectionSettings = _b[1];
                        return (React.createElement(React.Fragment, { key: "section-" + i },
                            React.createElement("tr", null,
                                React.createElement("td", { className: "admin-settings-section" }, sectionName),
                                React.createElement("td", null)),
                            Object.entries(sectionSettings).map(function (_a, j) {
                                var _b = __read(_a, 2), settingName = _b[0], settingValue = _b[1];
                                return (React.createElement("tr", { key: "property-" + j },
                                    React.createElement("td", { style: { paddingLeft: '25px' } }, settingName),
                                    React.createElement("td", { style: { whiteSpace: 'break-spaces' } }, settingValue)));
                            })));
                    }))))));
    };
    return AdminSettings;
}(React.PureComponent));
export { AdminSettings };
var mapStateToProps = function (state) { return ({
    navModel: getNavModel(state.navIndex, 'server-settings'),
}); };
export default connect(mapStateToProps)(AdminSettings);
//# sourceMappingURL=AdminSettings.js.map