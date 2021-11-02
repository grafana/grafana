import { __makeTemplateObject } from "tslib";
import React, { useEffect, useMemo, memo } from 'react';
import { css, cx } from '@emotion/css';
import { connect } from 'react-redux';
import { Icon, LinkButton, Pagination, RadioButtonGroup, Tooltip, useStyles2, FilterInput, } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import { contextSrv } from 'app/core/core';
import { getNavModel } from '../../core/selectors/navModel';
import { AccessControlAction } from '../../types';
import { changeFilter, changePage, changeQuery, fetchUsers } from './state/actions';
import PageLoader from '../../core/components/PageLoader/PageLoader';
var extraFilters = [];
export var addExtraFilters = function (filter) {
    extraFilters.push(filter);
};
var mapDispatchToProps = {
    fetchUsers: fetchUsers,
    changeQuery: changeQuery,
    changePage: changePage,
    changeFilter: changeFilter,
};
var mapStateToProps = function (state) { return ({
    navModel: getNavModel(state.navIndex, 'global-users'),
    users: state.userListAdmin.users,
    query: state.userListAdmin.query,
    showPaging: state.userListAdmin.showPaging,
    totalPages: state.userListAdmin.totalPages,
    page: state.userListAdmin.page,
    filters: state.userListAdmin.filters,
    isLoading: state.userListAdmin.isLoading,
}); };
var connector = connect(mapStateToProps, mapDispatchToProps);
var UserListAdminPageUnConnected = function (_a) {
    var _b;
    var fetchUsers = _a.fetchUsers, navModel = _a.navModel, query = _a.query, changeQuery = _a.changeQuery, users = _a.users, showPaging = _a.showPaging, totalPages = _a.totalPages, page = _a.page, changePage = _a.changePage, changeFilter = _a.changeFilter, filters = _a.filters, isLoading = _a.isLoading;
    var styles = useStyles2(getStyles);
    useEffect(function () {
        fetchUsers();
    }, [fetchUsers]);
    var showLicensedRole = useMemo(function () { return users.some(function (user) { return user.licensedRole; }); }, [users]);
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            React.createElement("div", { className: "page-action-bar" },
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement(FilterInput, { placeholder: "Search user by login, email, or name.", autoFocus: true, value: query, onChange: changeQuery }),
                    React.createElement(RadioButtonGroup, { options: [
                            { label: 'All users', value: false },
                            { label: 'Active last 30 days', value: true },
                        ], onChange: function (value) { return changeFilter({ name: 'activeLast30Days', value: value }); }, value: (_b = filters.find(function (f) { return f.name === 'activeLast30Days'; })) === null || _b === void 0 ? void 0 : _b.value, className: styles.filter }),
                    extraFilters.map(function (FilterComponent, index) { return (React.createElement(FilterComponent, { key: index, filters: filters, onChange: changeFilter, className: styles.filter })); })),
                contextSrv.hasPermission(AccessControlAction.UsersCreate) && (React.createElement(LinkButton, { href: "admin/users/create", variant: "primary" }, "New user"))),
            isLoading ? (React.createElement(PageLoader, null)) : (React.createElement(React.Fragment, null,
                React.createElement("div", { className: cx(styles.table, 'admin-list-table') },
                    React.createElement("table", { className: "filter-table form-inline filter-table--hover" },
                        React.createElement("thead", null,
                            React.createElement("tr", null,
                                React.createElement("th", null),
                                React.createElement("th", null, "Login"),
                                React.createElement("th", null, "Email"),
                                React.createElement("th", null, "Name"),
                                React.createElement("th", null, "Belongs to"),
                                showLicensedRole && (React.createElement("th", null,
                                    "Licensed role",
                                    ' ',
                                    React.createElement(Tooltip, { placement: "top", content: React.createElement(React.Fragment, null,
                                            "Licensed role is based on a user's Org role (i.e. Viewer, Editor, Admin) and their dashboard/folder permissions.",
                                            ' ',
                                            React.createElement("a", { className: styles.link, target: "_blank", rel: "noreferrer noopener", href: 'https://grafana.com/docs/grafana/next/enterprise/license/license-restrictions/#active-users-limit' }, "Learn more")) },
                                        React.createElement(Icon, { name: "question-circle" })))),
                                React.createElement("th", null,
                                    "Last active\u00A0",
                                    React.createElement(Tooltip, { placement: "top", content: "Time since user was seen using Grafana" },
                                        React.createElement(Icon, { name: "question-circle" }))),
                                React.createElement("th", { style: { width: '1%' } }))),
                        React.createElement("tbody", null, users.map(function (user) { return (React.createElement(UserListItem, { user: user, showLicensedRole: showLicensedRole, key: user.id })); })))),
                showPaging && React.createElement(Pagination, { numberOfPages: totalPages, currentPage: page, onNavigate: changePage }))))));
};
var getUsersAriaLabel = function (name) {
    return "Edit user's " + name + " details";
};
var UserListItem = memo(function (_a) {
    var _b;
    var user = _a.user, showLicensedRole = _a.showLicensedRole;
    var styles = useStyles2(getStyles);
    var editUrl = "admin/users/edit/" + user.id;
    return (React.createElement("tr", { key: user.id },
        React.createElement("td", { className: "width-4 text-center link-td" },
            React.createElement("a", { href: editUrl, "aria-label": "Edit user's " + user.name + " details" },
                React.createElement("img", { className: "filter-table__avatar", src: user.avatarUrl, alt: "Avatar for user " + user.name }))),
        React.createElement("td", { className: "link-td max-width-10" },
            React.createElement("a", { className: "ellipsis", href: editUrl, title: user.login, "aria-label": getUsersAriaLabel(user.name) }, user.login)),
        React.createElement("td", { className: "link-td max-width-10" },
            React.createElement("a", { className: "ellipsis", href: editUrl, title: user.email, "aria-label": getUsersAriaLabel(user.name) }, user.email)),
        React.createElement("td", { className: "link-td max-width-10" },
            React.createElement("a", { className: "ellipsis", href: editUrl, title: user.name, "aria-label": getUsersAriaLabel(user.name) }, user.name)),
        React.createElement("td", { className: styles.row, title: ((_b = user.orgs) === null || _b === void 0 ? void 0 : _b.length)
                ? "The user is a member of the following organizations: " + user.orgs.map(function (org) { return org.name; }).join(',')
                : undefined },
            React.createElement(OrgUnits, { units: user.orgs, icon: 'building' }),
            user.isAdmin && (React.createElement("a", { href: editUrl, "aria-label": getUsersAriaLabel(user.name) },
                React.createElement(Tooltip, { placement: "top", content: "Grafana Admin" },
                    React.createElement(Icon, { name: "shield" }))))),
        showLicensedRole && (React.createElement("td", { className: cx('link-td', styles.iconRow) },
            React.createElement("a", { className: "ellipsis", href: editUrl, title: user.name, "aria-label": getUsersAriaLabel(user.name) }, user.licensedRole === 'None' ? (React.createElement("span", { className: styles.disabled },
                "Not assigned",
                ' ',
                React.createElement(Tooltip, { placement: "top", content: "A licensed role will be assigned when this user signs in" },
                    React.createElement(Icon, { name: "question-circle" })))) : (user.licensedRole)))),
        React.createElement("td", { className: "link-td" }, user.lastSeenAtAge && (React.createElement("a", { href: editUrl, "aria-label": "Last seen at " + user.lastSeenAtAge + ". Follow to edit user's " + user.name + " details." }, user.lastSeenAtAge === '10 years' ? React.createElement("span", { className: styles.disabled }, "Never") : user.lastSeenAtAge))),
        React.createElement("td", { className: "text-right" }, Array.isArray(user.authLabels) && user.authLabels.length > 0 && (React.createElement(TagBadge, { label: user.authLabels[0], removeIcon: false, count: 0 }))),
        React.createElement("td", { className: "text-right" }, user.isDisabled && React.createElement("span", { className: "label label-tag label-tag--gray" }, "Disabled"))));
});
UserListItem.displayName = 'UserListItem';
var OrgUnits = function (_a) {
    var units = _a.units, icon = _a.icon;
    var styles = useStyles2(getStyles);
    if (!(units === null || units === void 0 ? void 0 : units.length)) {
        return null;
    }
    return units.length > 1 ? (React.createElement(Tooltip, { placement: 'top', content: React.createElement("div", { className: styles.unitTooltip }, units === null || units === void 0 ? void 0 : units.map(function (unit) { return (React.createElement("a", { href: unit.url, className: styles.link, title: unit.name, key: unit.name, "aria-label": "Edit " + unit.name }, unit.name)); })) },
        React.createElement("div", { className: styles.unitItem },
            React.createElement(Icon, { name: icon }),
            " ",
            React.createElement("span", null, units.length)))) : (React.createElement("a", { href: units[0].url, className: styles.unitItem, title: units[0].name, key: units[0].name, "aria-label": "Edit " + units[0].name },
        React.createElement(Icon, { name: icon }),
        " ",
        units[0].name));
};
var getStyles = function (theme) {
    return {
        table: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-top: ", ";\n    "], ["\n      margin-top: ", ";\n    "])), theme.spacing(3)),
        filter: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin: 0 ", ";\n    "], ["\n      margin: 0 ", ";\n    "])), theme.spacing(1)),
        iconRow: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      svg {\n        margin-left: ", ";\n      }\n    "], ["\n      svg {\n        margin-left: ", ";\n      }\n    "])), theme.spacing(0.5)),
        row: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      height: 100% !important;\n\n      a {\n        padding: ", " 0 !important;\n      }\n    "], ["\n      display: flex;\n      align-items: center;\n      height: 100% !important;\n\n      a {\n        padding: ", " 0 !important;\n      }\n    "])), theme.spacing(0.5)),
        unitTooltip: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n    "], ["\n      display: flex;\n      flex-direction: column;\n    "]))),
        unitItem: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      cursor: pointer;\n      padding: ", " 0;\n      margin-right: ", ";\n    "], ["\n      cursor: pointer;\n      padding: ", " 0;\n      margin-right: ", ";\n    "])), theme.spacing(0.5), theme.spacing(1)),
        disabled: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      color: ", ";\n    "], ["\n      color: ", ";\n    "])), theme.colors.text.disabled),
        link: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      color: inherit;\n      cursor: pointer;\n      text-decoration: underline;\n    "], ["\n      color: inherit;\n      cursor: pointer;\n      text-decoration: underline;\n    "]))),
    };
};
export default connector(UserListAdminPageUnConnected);
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8;
//# sourceMappingURL=UserListAdminPage.js.map