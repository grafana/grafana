import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { connect } from 'react-redux';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { LinkButton, RadioButtonGroup, useStyles2, FilterInput } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from '../../types';
import { UsersTable } from './Users/UsersTable';
import { changeFilter, changePage, changeQuery, changeSort, fetchUsers } from './state/actions';
const extraFilters = [];
export const addExtraFilters = (filter) => {
    extraFilters.push(filter);
};
const selectors = e2eSelectors.pages.UserListPage.UserListAdminPage;
const mapDispatchToProps = {
    fetchUsers,
    changeQuery,
    changePage,
    changeFilter,
    changeSort,
};
const mapStateToProps = (state) => ({
    users: state.userListAdmin.users,
    query: state.userListAdmin.query,
    showPaging: state.userListAdmin.showPaging,
    totalPages: state.userListAdmin.totalPages,
    page: state.userListAdmin.page,
    filters: state.userListAdmin.filters,
});
const connector = connect(mapStateToProps, mapDispatchToProps);
const UserListAdminPageUnConnected = ({ fetchUsers, query, changeQuery, users, showPaging, changeFilter, filters, totalPages, page, changePage, changeSort, }) => {
    var _a;
    const styles = useStyles2(getStyles);
    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);
    return (React.createElement(Page.Contents, null,
        React.createElement("div", { className: styles.actionBar, "data-testid": selectors.container },
            React.createElement("div", { className: styles.row },
                React.createElement(FilterInput, { placeholder: "Search user by login, email, or name.", autoFocus: true, value: query, onChange: changeQuery }),
                React.createElement(RadioButtonGroup, { options: [
                        { label: 'All users', value: false },
                        { label: 'Active last 30 days', value: true },
                    ], onChange: (value) => changeFilter({ name: 'activeLast30Days', value }), value: (_a = filters.find((f) => f.name === 'activeLast30Days')) === null || _a === void 0 ? void 0 : _a.value, className: styles.filter }),
                extraFilters.map((FilterComponent, index) => (React.createElement(FilterComponent, { key: index, filters: filters, onChange: changeFilter, className: styles.filter }))),
                contextSrv.hasPermission(AccessControlAction.UsersCreate) && (React.createElement(LinkButton, { href: "admin/users/create", variant: "primary" }, "New user")))),
        React.createElement(UsersTable, { users: users, showPaging: showPaging, totalPages: totalPages, onChangePage: changePage, currentPage: page, fetchData: changeSort })));
};
export const UserListAdminPageContent = connector(UserListAdminPageUnConnected);
export function UserListAdminPage() {
    return (React.createElement(Page, { navId: "global-users" },
        React.createElement(UserListAdminPageContent, null)));
}
const getStyles = (theme) => {
    return {
        filter: css({
            margin: theme.spacing(0, 1),
            [theme.breakpoints.down('sm')]: {
                margin: 0,
            },
        }),
        actionBar: css({
            marginBottom: theme.spacing(2),
            display: 'flex',
            alignItems: 'flex-start',
            gap: theme.spacing(2),
            [theme.breakpoints.down('sm')]: {
                flexWrap: 'wrap',
            },
        }),
        row: css({
            display: 'flex',
            alignItems: 'flex-start',
            textAlign: 'left',
            marginBottom: theme.spacing(0.5),
            flexGrow: 1,
            [theme.breakpoints.down('sm')]: {
                flexWrap: 'wrap',
                gap: theme.spacing(2),
                width: '100%',
            },
        }),
    };
};
export default UserListAdminPage;
//# sourceMappingURL=UserListAdminPage.js.map