import { __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { getNavModel } from 'app/core/selectors/navModel';
import config from 'app/core/config';
import Page from 'app/core/components/Page/Page';
import { UserProfile } from './UserProfile';
import { UserPermissions } from './UserPermissions';
import { UserSessions } from './UserSessions';
import { UserLdapSyncInfo } from './UserLdapSyncInfo';
import { AccessControlAction } from 'app/types';
import { loadAdminUserPage, revokeSession, revokeAllSessions, updateUser, setUserPassword, disableUser, enableUser, deleteUser, updateUserPermissions, addOrgUser, updateOrgUserRole, deleteOrgUser, syncLdapUser, } from './state/actions';
import { UserOrgs } from './UserOrgs';
import { contextSrv } from 'app/core/core';
var UserAdminPage = /** @class */ (function (_super) {
    __extends(UserAdminPage, _super);
    function UserAdminPage() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onUserUpdate = function (user) {
            _this.props.updateUser(user);
        };
        _this.onPasswordChange = function (password) {
            var _a = _this.props, user = _a.user, setUserPassword = _a.setUserPassword;
            user && setUserPassword(user.id, password);
        };
        _this.onUserDelete = function (userId) {
            _this.props.deleteUser(userId);
        };
        _this.onUserDisable = function (userId) {
            _this.props.disableUser(userId);
        };
        _this.onUserEnable = function (userId) {
            _this.props.enableUser(userId);
        };
        _this.onGrafanaAdminChange = function (isGrafanaAdmin) {
            var _a = _this.props, user = _a.user, updateUserPermissions = _a.updateUserPermissions;
            user && updateUserPermissions(user.id, isGrafanaAdmin);
        };
        _this.onOrgRemove = function (orgId) {
            var _a = _this.props, user = _a.user, deleteOrgUser = _a.deleteOrgUser;
            user && deleteOrgUser(user.id, orgId);
        };
        _this.onOrgRoleChange = function (orgId, newRole) {
            var _a = _this.props, user = _a.user, updateOrgUserRole = _a.updateOrgUserRole;
            user && updateOrgUserRole(user.id, orgId, newRole);
        };
        _this.onOrgAdd = function (orgId, role) {
            var _a = _this.props, user = _a.user, addOrgUser = _a.addOrgUser;
            user && addOrgUser(user, orgId, role);
        };
        _this.onSessionRevoke = function (tokenId) {
            var _a = _this.props, user = _a.user, revokeSession = _a.revokeSession;
            user && revokeSession(tokenId, user.id);
        };
        _this.onAllSessionsRevoke = function () {
            var _a = _this.props, user = _a.user, revokeAllSessions = _a.revokeAllSessions;
            user && revokeAllSessions(user.id);
        };
        _this.onUserSync = function () {
            var _a = _this.props, user = _a.user, syncLdapUser = _a.syncLdapUser;
            user && syncLdapUser(user.id);
        };
        return _this;
    }
    UserAdminPage.prototype.componentDidMount = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, match, loadAdminUserPage;
            return __generator(this, function (_b) {
                _a = this.props, match = _a.match, loadAdminUserPage = _a.loadAdminUserPage;
                loadAdminUserPage(parseInt(match.params.id, 10));
                return [2 /*return*/];
            });
        });
    };
    UserAdminPage.prototype.render = function () {
        var _a = this.props, navModel = _a.navModel, user = _a.user, orgs = _a.orgs, sessions = _a.sessions, ldapSyncInfo = _a.ldapSyncInfo, isLoading = _a.isLoading;
        var isLDAPUser = user && user.isExternal && user.authLabels && user.authLabels.includes('LDAP');
        var canReadSessions = contextSrv.hasPermission(AccessControlAction.UsersAuthTokenList);
        var canReadLDAPStatus = contextSrv.hasPermission(AccessControlAction.LDAPStatusRead);
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, { isLoading: isLoading },
                user && (React.createElement(React.Fragment, null,
                    React.createElement(UserProfile, { user: user, onUserUpdate: this.onUserUpdate, onUserDelete: this.onUserDelete, onUserDisable: this.onUserDisable, onUserEnable: this.onUserEnable, onPasswordChange: this.onPasswordChange }),
                    isLDAPUser && config.licenseInfo.hasLicense && ldapSyncInfo && canReadLDAPStatus && (React.createElement(UserLdapSyncInfo, { ldapSyncInfo: ldapSyncInfo, user: user, onUserSync: this.onUserSync })),
                    React.createElement(UserPermissions, { isGrafanaAdmin: user.isGrafanaAdmin, onGrafanaAdminChange: this.onGrafanaAdminChange }))),
                orgs && (React.createElement(UserOrgs, { orgs: orgs, isExternalUser: user === null || user === void 0 ? void 0 : user.isExternal, onOrgRemove: this.onOrgRemove, onOrgRoleChange: this.onOrgRoleChange, onOrgAdd: this.onOrgAdd })),
                sessions && canReadSessions && (React.createElement(UserSessions, { sessions: sessions, onSessionRevoke: this.onSessionRevoke, onAllSessionsRevoke: this.onAllSessionsRevoke })))));
    };
    return UserAdminPage;
}(PureComponent));
export { UserAdminPage };
var mapStateToProps = function (state) { return ({
    navModel: getNavModel(state.navIndex, 'global-users'),
    user: state.userAdmin.user,
    sessions: state.userAdmin.sessions,
    orgs: state.userAdmin.orgs,
    ldapSyncInfo: state.ldap.syncInfo,
    isLoading: state.userAdmin.isLoading,
    error: state.userAdmin.error,
}); };
var mapDispatchToProps = {
    loadAdminUserPage: loadAdminUserPage,
    updateUser: updateUser,
    setUserPassword: setUserPassword,
    disableUser: disableUser,
    enableUser: enableUser,
    deleteUser: deleteUser,
    updateUserPermissions: updateUserPermissions,
    addOrgUser: addOrgUser,
    updateOrgUserRole: updateOrgUserRole,
    deleteOrgUser: deleteOrgUser,
    revokeSession: revokeSession,
    revokeAllSessions: revokeAllSessions,
    syncLdapUser: syncLdapUser,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
export default connector(UserAdminPage);
//# sourceMappingURL=UserAdminPage.js.map