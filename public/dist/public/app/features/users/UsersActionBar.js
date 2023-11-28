import React from 'react';
import { connect } from 'react-redux';
import { RadioButtonGroup, LinkButton, FilterInput, InlineField } from '@grafana/ui';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
import { selectTotal } from '../invites/state/selectors';
import { changeSearchQuery } from './state/actions';
import { getUsersSearchQuery } from './state/selectors';
function mapStateToProps(state) {
    return {
        searchQuery: getUsersSearchQuery(state.users),
        pendingInvitesCount: selectTotal(state.invites),
        externalUserMngLinkName: state.users.externalUserMngLinkName,
        externalUserMngLinkUrl: state.users.externalUserMngLinkUrl,
    };
}
const mapDispatchToProps = {
    changeSearchQuery,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export const UsersActionBarUnconnected = ({ externalUserMngLinkName, externalUserMngLinkUrl, searchQuery, pendingInvitesCount, changeSearchQuery, onShowInvites, showInvites, }) => {
    const options = [
        { label: 'Users', value: 'users' },
        { label: `Pending Invites (${pendingInvitesCount})`, value: 'invites' },
    ];
    const canAddToOrg = contextSrv.hasPermission(AccessControlAction.OrgUsersAdd);
    // Show invite button in the following cases:
    // 1) the instance is not a hosted Grafana instance (!config.externalUserMngInfo)
    // 2) new basic auth users can be created for this instance (!config.disableLoginForm).
    const showInviteButton = canAddToOrg && !(config.disableLoginForm && config.externalUserMngInfo);
    return (React.createElement("div", { className: "page-action-bar", "data-testid": "users-action-bar" },
        React.createElement(InlineField, { grow: true },
            React.createElement(FilterInput, { value: searchQuery, onChange: changeSearchQuery, placeholder: "Search user by login, email or name" })),
        pendingInvitesCount > 0 && (React.createElement("div", { style: { marginLeft: '1rem' } },
            React.createElement(RadioButtonGroup, { value: showInvites ? 'invites' : 'users', options: options, onChange: onShowInvites }))),
        showInviteButton && React.createElement(LinkButton, { href: "org/users/invite" }, "Invite"),
        externalUserMngLinkUrl && (React.createElement(LinkButton, { href: externalUserMngLinkUrl, target: "_blank", rel: "noopener" }, externalUserMngLinkName))));
};
export const UsersActionBar = connector(UsersActionBarUnconnected);
//# sourceMappingURL=UsersActionBar.js.map