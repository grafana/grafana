import { __awaiter, __extends, __generator } from "tslib";
import React from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { Modal, Button, CustomScrollbar } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import config from 'app/core/config';
import { css } from '@emotion/css';
var OrgSwitcher = /** @class */ (function (_super) {
    __extends(OrgSwitcher, _super);
    function OrgSwitcher() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            orgs: [],
        };
        _this.getUserOrgs = function () { return __awaiter(_this, void 0, void 0, function () {
            var orgs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getBackendSrv().get('/api/user/orgs')];
                    case 1:
                        orgs = _a.sent();
                        this.setState({ orgs: orgs });
                        return [2 /*return*/];
                }
            });
        }); };
        _this.setCurrentOrg = function (org) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getBackendSrv().post("/api/user/using/" + org.orgId)];
                    case 1:
                        _a.sent();
                        this.setWindowLocation("" + config.appSubUrl + (config.appSubUrl.endsWith('/') ? '' : '/') + "?orgId=" + org.orgId);
                        return [2 /*return*/];
                }
            });
        }); };
        return _this;
    }
    OrgSwitcher.prototype.componentDidMount = function () {
        this.getUserOrgs();
    };
    OrgSwitcher.prototype.setWindowLocation = function (href) {
        window.location.href = href;
    };
    OrgSwitcher.prototype.render = function () {
        var _this = this;
        var onDismiss = this.props.onDismiss;
        var orgs = this.state.orgs;
        var currentOrgId = contextSrv.user.orgId;
        var contentClassName = css({
            display: 'flex',
            maxHeight: 'calc(85vh - 42px)',
        });
        return (React.createElement(Modal, { title: "Switch Organization", icon: "arrow-random", onDismiss: onDismiss, isOpen: true, contentClassName: contentClassName },
            React.createElement(CustomScrollbar, { autoHeightMin: "100%" },
                React.createElement("table", { className: "filter-table form-inline" },
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "Name"),
                            React.createElement("th", null, "Role"),
                            React.createElement("th", null))),
                    React.createElement("tbody", null, orgs.map(function (org) { return (React.createElement("tr", { key: org.orgId },
                        React.createElement("td", null, org.name),
                        React.createElement("td", null, org.role),
                        React.createElement("td", { className: "text-right" }, org.orgId === currentOrgId ? (React.createElement(Button, { size: "sm" }, "Current")) : (React.createElement(Button, { variant: "secondary", size: "sm", onClick: function () { return _this.setCurrentOrg(org); } }, "Switch to"))))); }))))));
    };
    return OrgSwitcher;
}(React.PureComponent));
export { OrgSwitcher };
//# sourceMappingURL=OrgSwitcher.js.map