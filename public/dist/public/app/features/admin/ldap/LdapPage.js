import { __awaiter } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { featureEnabled } from '@grafana/runtime';
import { Alert, Button, Field, Form, HorizontalGroup, Input } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { AppNotificationSeverity, AccessControlAction, } from 'app/types';
import { loadLdapState, loadLdapSyncStatus, loadUserMapping, clearUserError, clearUserMappingInfo, } from '../state/actions';
import { LdapConnectionStatus } from './LdapConnectionStatus';
import { LdapSyncInfo } from './LdapSyncInfo';
import { LdapUserInfo } from './LdapUserInfo';
const pageNav = {
    text: 'LDAP',
    subTitle: `Verify your LDAP and user mapping configuration.`,
    icon: 'book',
    id: 'LDAP',
};
export class LdapPage extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            isLoading: true,
        };
        this.search = (username) => {
            if (username) {
                this.fetchUserMapping(username);
            }
        };
        this.onClearUserError = () => {
            this.props.clearUserError();
        };
    }
    componentDidMount() {
        return __awaiter(this, void 0, void 0, function* () {
            const { clearUserMappingInfo, queryParams } = this.props;
            yield clearUserMappingInfo();
            yield this.fetchLDAPStatus();
            if (queryParams.username) {
                yield this.fetchUserMapping(queryParams.username);
            }
            this.setState({ isLoading: false });
        });
    }
    fetchLDAPStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            const { loadLdapState, loadLdapSyncStatus } = this.props;
            return Promise.all([loadLdapState(), loadLdapSyncStatus()]);
        });
    }
    fetchUserMapping(username) {
        return __awaiter(this, void 0, void 0, function* () {
            const { loadUserMapping } = this.props;
            return yield loadUserMapping(username);
        });
    }
    render() {
        const { ldapUser, userError, ldapError, ldapSyncInfo, ldapConnectionInfo, queryParams } = this.props;
        const { isLoading } = this.state;
        const canReadLDAPUser = contextSrv.hasPermission(AccessControlAction.LDAPUsersRead);
        return (React.createElement(Page, { navId: "authentication", pageNav: pageNav },
            React.createElement(Page.Contents, { isLoading: isLoading },
                React.createElement(React.Fragment, null,
                    ldapError && ldapError.title && (React.createElement(Alert, { title: ldapError.title, severity: AppNotificationSeverity.Error }, ldapError.body)),
                    React.createElement(LdapConnectionStatus, { ldapConnectionInfo: ldapConnectionInfo }),
                    featureEnabled('ldapsync') && ldapSyncInfo && React.createElement(LdapSyncInfo, { ldapSyncInfo: ldapSyncInfo }),
                    canReadLDAPUser && (React.createElement(React.Fragment, null,
                        React.createElement("h3", null, "Test user mapping"),
                        React.createElement(Form, { onSubmit: (data) => this.search(data.username) }, ({ register }) => (React.createElement(HorizontalGroup, null,
                            React.createElement(Field, { label: "Username" },
                                React.createElement(Input, Object.assign({}, register('username', { required: true }), { id: "username", type: "text", defaultValue: queryParams.username }))),
                            React.createElement(Button, { variant: "primary", type: "submit" }, "Run")))),
                        userError && userError.title && (React.createElement(Alert, { title: userError.title, severity: AppNotificationSeverity.Error, onRemove: this.onClearUserError }, userError.body)),
                        ldapUser && React.createElement(LdapUserInfo, { ldapUser: ldapUser, showAttributeMapping: true })))))));
    }
}
const mapStateToProps = (state) => ({
    ldapConnectionInfo: state.ldap.connectionInfo,
    ldapUser: state.ldap.user,
    ldapSyncInfo: state.ldap.syncInfo,
    userError: state.ldap.userError,
    ldapError: state.ldap.ldapError,
});
const mapDispatchToProps = {
    loadLdapState,
    loadLdapSyncStatus,
    loadUserMapping,
    clearUserError,
    clearUserMappingInfo,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export default connector(LdapPage);
//# sourceMappingURL=LdapPage.js.map