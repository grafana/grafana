import React, { useEffect, useState } from 'react';
import { connect } from 'react-redux';
import { renderMarkdown } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { OrgUsersTable } from '../admin/Users/OrgUsersTable';
import InviteesTable from '../invites/InviteesTable';
import { fetchInvitees } from '../invites/state/actions';
import { selectInvitesMatchingQuery } from '../invites/state/selectors';
import { UsersActionBar } from './UsersActionBar';
import { loadUsers, removeUser, updateUser, changePage, changeSort } from './state/actions';
import { getUsers, getUsersSearchQuery } from './state/selectors';
function mapStateToProps(state) {
    const searchQuery = getUsersSearchQuery(state.users);
    return {
        users: getUsers(state.users),
        searchQuery: getUsersSearchQuery(state.users),
        page: state.users.page,
        totalPages: state.users.totalPages,
        perPage: state.users.perPage,
        invitees: selectInvitesMatchingQuery(state.invites, searchQuery),
        externalUserMngInfo: state.users.externalUserMngInfo,
        isLoading: state.users.isLoading,
    };
}
const mapDispatchToProps = {
    loadUsers,
    fetchInvitees,
    changePage,
    changeSort,
    updateUser,
    removeUser,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export const UsersListPageUnconnected = ({ users, page, totalPages, invitees, externalUserMngInfo, isLoading, loadUsers, fetchInvitees, changePage, updateUser, removeUser, changeSort, }) => {
    const [showInvites, setShowInvites] = useState(false);
    const externalUserMngInfoHtml = externalUserMngInfo ? renderMarkdown(externalUserMngInfo) : '';
    useEffect(() => {
        loadUsers();
        fetchInvitees();
    }, [fetchInvitees, loadUsers]);
    const onRoleChange = (role, user) => {
        updateUser(Object.assign(Object.assign({}, user), { role: role }));
    };
    const onRemoveUser = (user) => removeUser(user.userId);
    const onShowInvites = () => {
        setShowInvites(!showInvites);
    };
    const renderTable = () => {
        if (showInvites) {
            return React.createElement(InviteesTable, { invitees: invitees });
        }
        else {
            return (React.createElement(OrgUsersTable, { users: users, orgId: contextSrv.user.orgId, onRoleChange: onRoleChange, onRemoveUser: onRemoveUser, fetchData: changeSort, changePage: changePage, page: page, totalPages: totalPages }));
        }
    };
    return (React.createElement(Page.Contents, { isLoading: !isLoading },
        React.createElement(UsersActionBar, { onShowInvites: onShowInvites, showInvites: showInvites }),
        externalUserMngInfoHtml && (React.createElement("div", { className: "grafana-info-box", dangerouslySetInnerHTML: { __html: externalUserMngInfoHtml } })),
        isLoading && renderTable()));
};
export const UsersListPageContent = connector(UsersListPageUnconnected);
export default function UsersListPage() {
    return (React.createElement(Page, { navId: "users" },
        React.createElement(UsersListPageContent, null)));
}
//# sourceMappingURL=UsersListPage.js.map