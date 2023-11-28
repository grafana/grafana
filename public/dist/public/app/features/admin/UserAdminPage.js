import { __awaiter } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { featureEnabled } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
import { UserLdapSyncInfo } from './UserLdapSyncInfo';
import { UserOrgs } from './UserOrgs';
import { UserPermissions } from './UserPermissions';
import { UserProfile } from './UserProfile';
import { UserSessions } from './UserSessions';
import { loadAdminUserPage, revokeSession, revokeAllSessions, updateUser, setUserPassword, disableUser, enableUser, deleteUser, updateUserPermissions, addOrgUser, updateOrgUserRole, deleteOrgUser, syncLdapUser, } from './state/actions';
export class UserAdminPage extends PureComponent {
    constructor() {
        super(...arguments);
        this.onUserUpdate = (user) => {
            this.props.updateUser(user);
        };
        this.onPasswordChange = (password) => {
            const { user, setUserPassword } = this.props;
            user && setUserPassword(user.id, password);
        };
        this.onUserDelete = (userId) => {
            this.props.deleteUser(userId);
        };
        this.onUserDisable = (userId) => {
            this.props.disableUser(userId);
        };
        this.onUserEnable = (userId) => {
            this.props.enableUser(userId);
        };
        this.onGrafanaAdminChange = (isGrafanaAdmin) => {
            const { user, updateUserPermissions } = this.props;
            user && updateUserPermissions(user.id, isGrafanaAdmin);
        };
        this.onOrgRemove = (orgId) => {
            const { user, deleteOrgUser } = this.props;
            user && deleteOrgUser(user.id, orgId);
        };
        this.onOrgRoleChange = (orgId, newRole) => {
            const { user, updateOrgUserRole } = this.props;
            user && updateOrgUserRole(user.id, orgId, newRole);
        };
        this.onOrgAdd = (orgId, role) => {
            const { user, addOrgUser } = this.props;
            user && addOrgUser(user, orgId, role);
        };
        this.onSessionRevoke = (tokenId) => {
            const { user, revokeSession } = this.props;
            user && revokeSession(tokenId, user.id);
        };
        this.onAllSessionsRevoke = () => {
            const { user, revokeAllSessions } = this.props;
            user && revokeAllSessions(user.id);
        };
        this.onUserSync = () => {
            const { user, syncLdapUser } = this.props;
            user && syncLdapUser(user.id);
        };
    }
    componentDidMount() {
        return __awaiter(this, void 0, void 0, function* () {
            const { match, loadAdminUserPage } = this.props;
            loadAdminUserPage(parseInt(match.params.id, 10));
        });
    }
    render() {
        var _a, _b, _c;
        const { user, orgs, sessions, ldapSyncInfo, isLoading } = this.props;
        const isLDAPUser = (user === null || user === void 0 ? void 0 : user.isExternal) && ((_a = user === null || user === void 0 ? void 0 : user.authLabels) === null || _a === void 0 ? void 0 : _a.includes('LDAP'));
        const canReadSessions = contextSrv.hasPermission(AccessControlAction.UsersAuthTokenList);
        const canReadLDAPStatus = contextSrv.hasPermission(AccessControlAction.LDAPStatusRead);
        const authSource = (_b = user === null || user === void 0 ? void 0 : user.authLabels) === null || _b === void 0 ? void 0 : _b[0];
        const lockMessage = authSource ? `Synced via ${authSource}` : '';
        const pageNav = {
            text: (_c = user === null || user === void 0 ? void 0 : user.login) !== null && _c !== void 0 ? _c : '',
            icon: 'shield',
            subTitle: 'Manage settings for an individual user.',
        };
        return (React.createElement(Page, { navId: "global-users", pageNav: pageNav },
            React.createElement(Page.Contents, { isLoading: isLoading },
                user && (React.createElement(React.Fragment, null,
                    React.createElement(UserProfile, { user: user, onUserUpdate: this.onUserUpdate, onUserDelete: this.onUserDelete, onUserDisable: this.onUserDisable, onUserEnable: this.onUserEnable, onPasswordChange: this.onPasswordChange }),
                    isLDAPUser &&
                        (user === null || user === void 0 ? void 0 : user.isExternallySynced) &&
                        featureEnabled('ldapsync') &&
                        ldapSyncInfo &&
                        canReadLDAPStatus && (React.createElement(UserLdapSyncInfo, { ldapSyncInfo: ldapSyncInfo, user: user, onUserSync: this.onUserSync })),
                    React.createElement(UserPermissions, { isGrafanaAdmin: user.isGrafanaAdmin, isExternalUser: user === null || user === void 0 ? void 0 : user.isGrafanaAdminExternallySynced, lockMessage: lockMessage, onGrafanaAdminChange: this.onGrafanaAdminChange }))),
                orgs && (React.createElement(UserOrgs, { user: user, orgs: orgs, isExternalUser: user === null || user === void 0 ? void 0 : user.isExternallySynced, onOrgRemove: this.onOrgRemove, onOrgRoleChange: this.onOrgRoleChange, onOrgAdd: this.onOrgAdd })),
                sessions && canReadSessions && (React.createElement(UserSessions, { sessions: sessions, onSessionRevoke: this.onSessionRevoke, onAllSessionsRevoke: this.onAllSessionsRevoke })))));
    }
}
const mapStateToProps = (state) => ({
    user: state.userAdmin.user,
    sessions: state.userAdmin.sessions,
    orgs: state.userAdmin.orgs,
    ldapSyncInfo: state.ldap.syncInfo,
    isLoading: state.userAdmin.isLoading,
    error: state.userAdmin.error,
});
const mapDispatchToProps = {
    loadAdminUserPage,
    updateUser,
    setUserPassword,
    disableUser,
    enableUser,
    deleteUser,
    updateUserPermissions,
    addOrgUser,
    updateOrgUserRole,
    deleteOrgUser,
    revokeSession,
    revokeAllSessions,
    syncLdapUser,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export default connector(UserAdminPage);
//# sourceMappingURL=UserAdminPage.js.map