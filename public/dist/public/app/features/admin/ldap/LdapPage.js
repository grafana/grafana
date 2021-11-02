import { __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { Alert, Button, LegacyForms } from '@grafana/ui';
var FormField = LegacyForms.FormField;
import { getNavModel } from 'app/core/selectors/navModel';
import config from 'app/core/config';
import Page from 'app/core/components/Page/Page';
import { LdapConnectionStatus } from './LdapConnectionStatus';
import { LdapSyncInfo } from './LdapSyncInfo';
import { LdapUserInfo } from './LdapUserInfo';
import { AppNotificationSeverity, AccessControlAction, } from 'app/types';
import { loadLdapState, loadLdapSyncStatus, loadUserMapping, clearUserError, clearUserMappingInfo, } from '../state/actions';
import { contextSrv } from 'app/core/core';
var LdapPage = /** @class */ (function (_super) {
    __extends(LdapPage, _super);
    function LdapPage() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            isLoading: true,
        };
        _this.search = function (event) {
            event.preventDefault();
            var username = event.target.elements['username'].value;
            if (username) {
                _this.fetchUserMapping(username);
            }
        };
        _this.onClearUserError = function () {
            _this.props.clearUserError();
        };
        return _this;
    }
    LdapPage.prototype.componentDidMount = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, clearUserMappingInfo, queryParams;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.props, clearUserMappingInfo = _a.clearUserMappingInfo, queryParams = _a.queryParams;
                        return [4 /*yield*/, clearUserMappingInfo()];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, this.fetchLDAPStatus()];
                    case 2:
                        _b.sent();
                        if (!queryParams.username) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.fetchUserMapping(queryParams.username)];
                    case 3:
                        _b.sent();
                        _b.label = 4;
                    case 4:
                        this.setState({ isLoading: false });
                        return [2 /*return*/];
                }
            });
        });
    };
    LdapPage.prototype.fetchLDAPStatus = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, loadLdapState, loadLdapSyncStatus;
            return __generator(this, function (_b) {
                _a = this.props, loadLdapState = _a.loadLdapState, loadLdapSyncStatus = _a.loadLdapSyncStatus;
                return [2 /*return*/, Promise.all([loadLdapState(), loadLdapSyncStatus()])];
            });
        });
    };
    LdapPage.prototype.fetchUserMapping = function (username) {
        return __awaiter(this, void 0, void 0, function () {
            var loadUserMapping;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        loadUserMapping = this.props.loadUserMapping;
                        return [4 /*yield*/, loadUserMapping(username)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    LdapPage.prototype.render = function () {
        var _a = this.props, ldapUser = _a.ldapUser, userError = _a.userError, ldapError = _a.ldapError, ldapSyncInfo = _a.ldapSyncInfo, ldapConnectionInfo = _a.ldapConnectionInfo, navModel = _a.navModel, queryParams = _a.queryParams;
        var isLoading = this.state.isLoading;
        var canReadLDAPUser = contextSrv.hasPermission(AccessControlAction.LDAPUsersRead);
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, { isLoading: isLoading },
                React.createElement(React.Fragment, null,
                    ldapError && ldapError.title && (React.createElement("div", { className: "gf-form-group" },
                        React.createElement(Alert, { title: ldapError.title, severity: AppNotificationSeverity.Error }, ldapError.body))),
                    React.createElement(LdapConnectionStatus, { ldapConnectionInfo: ldapConnectionInfo }),
                    config.licenseInfo.hasLicense && ldapSyncInfo && React.createElement(LdapSyncInfo, { ldapSyncInfo: ldapSyncInfo }),
                    canReadLDAPUser && (React.createElement(React.Fragment, null,
                        React.createElement("h3", { className: "page-heading" }, "Test user mapping"),
                        React.createElement("div", { className: "gf-form-group" },
                            React.createElement("form", { onSubmit: this.search, className: "gf-form-inline" },
                                React.createElement(FormField, { label: "Username", labelWidth: 8, inputWidth: 30, type: "text", id: "username", name: "username", defaultValue: queryParams.username }),
                                React.createElement(Button, { type: "submit" }, "Run"))),
                        userError && userError.title && (React.createElement("div", { className: "gf-form-group" },
                            React.createElement(Alert, { title: userError.title, severity: AppNotificationSeverity.Error, onRemove: this.onClearUserError }, userError.body))),
                        ldapUser && React.createElement(LdapUserInfo, { ldapUser: ldapUser, showAttributeMapping: true })))))));
    };
    return LdapPage;
}(PureComponent));
export { LdapPage };
var mapStateToProps = function (state) { return ({
    navModel: getNavModel(state.navIndex, 'ldap'),
    ldapConnectionInfo: state.ldap.connectionInfo,
    ldapUser: state.ldap.user,
    ldapSyncInfo: state.ldap.syncInfo,
    userError: state.ldap.userError,
    ldapError: state.ldap.ldapError,
}); };
var mapDispatchToProps = {
    loadLdapState: loadLdapState,
    loadLdapSyncStatus: loadLdapSyncStatus,
    loadUserMapping: loadUserMapping,
    clearUserError: clearUserError,
    clearUserMappingInfo: clearUserMappingInfo,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
export default connector(LdapPage);
//# sourceMappingURL=LdapPage.js.map