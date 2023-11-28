import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { InteractiveTable, Tooltip, Icon, useStyles2, Tag, Pagination, VerticalGroup, HorizontalGroup, Avatar, } from '@grafana/ui';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import AccessRoleCell from 'app/percona/rbac/AccessRoleCell';
import AccessRoleHeader from 'app/percona/rbac/AccessRoleHeader';
import { useAccessRolesEnabled } from 'app/percona/rbac/hooks/useAccessRolesEnabled';
import { useFetchAccessRoles } from 'app/percona/rbac/hooks/useFetchAccessRoles';
import { OrgUnits } from './OrgUnits';
export const UsersTable = ({ users, showPaging, totalPages, onChangePage, currentPage, fetchData, }) => {
    const showLicensedRole = useMemo(() => users.some((user) => user.licensedRole), [users]);
    // @PERCONA
    const accessRolesEnabled = useAccessRolesEnabled();
    useFetchAccessRoles();
    // @ts-ignore
    const columns = useMemo(() => [
        {
            id: 'avatarUrl',
            header: '',
            cell: ({ cell: { value } }) => value && React.createElement(Avatar, { src: value, alt: 'User avatar' }),
        },
        {
            id: 'login',
            header: 'Login',
            cell: ({ cell: { value } }) => value,
            sortType: 'string',
        },
        {
            id: 'email',
            header: 'Email',
            cell: ({ cell: { value } }) => value,
            sortType: 'string',
        },
        {
            id: 'name',
            header: 'Name',
            cell: ({ cell: { value } }) => value,
            sortType: 'string',
        },
        {
            id: 'orgs',
            header: 'Belongs to',
            cell: OrgUnitsCell,
            sortType: (a, b) => { var _a, _b; return (((_a = a.original.orgs) === null || _a === void 0 ? void 0 : _a.length) || 0) - (((_b = b.original.orgs) === null || _b === void 0 ? void 0 : _b.length) || 0); },
        },
        ...(showLicensedRole
            ? [
                {
                    id: 'licensedRole',
                    header: 'Licensed role',
                    cell: LicensedRoleCell,
                    // Needs the assertion here, the types are not inferred correctly due to the  conditional assignment
                    sortType: 'string',
                },
            ]
            : []),
        {
            id: 'lastSeenAtAge',
            header: 'Last active',
            headerTooltip: {
                content: 'Time since user was seen using Grafana',
                iconName: 'question-circle',
            },
            cell: LastSeenAtCell,
            sortType: (a, b) => new Date(a.original.lastSeenAt).getTime() - new Date(b.original.lastSeenAt).getTime(),
        },
        {
            id: 'authLabels',
            header: 'Origin',
            cell: ({ cell: { value } }) => (React.createElement(React.Fragment, null, Array.isArray(value) && value.length > 0 && React.createElement(TagBadge, { label: value[0], removeIcon: false, count: 0 }))),
        },
        {
            id: 'isDisabled',
            header: '',
            cell: ({ cell: { value } }) => React.createElement(React.Fragment, null, value && React.createElement(Tag, { colorIndex: 9, name: 'Disabled' })),
        },
        // @PERCONA
        ...(accessRolesEnabled
            ? [
                {
                    id: 'perconaRBAC',
                    header: () => React.createElement(AccessRoleHeader, null),
                    cell: ({ row: { original: user } }) => React.createElement(AccessRoleCell, { user: user }),
                },
            ]
            : []),
        {
            id: 'edit',
            header: '',
            cell: ({ row: { original } }) => {
                return (React.createElement("a", { href: `admin/users/edit/${original.id}`, "aria-label": `Edit team ${original.name}` },
                    React.createElement(Tooltip, { content: 'Edit user' },
                        React.createElement(Icon, { name: 'pen' }))));
            },
        },
    ], [showLicensedRole, accessRolesEnabled]);
    return (React.createElement(VerticalGroup, { spacing: 'md' },
        React.createElement(InteractiveTable, { columns: columns, data: users, getRowId: (user) => String(user.id), fetchData: fetchData }),
        showPaging && (React.createElement(HorizontalGroup, { justify: 'flex-end' },
            React.createElement(Pagination, { numberOfPages: totalPages, currentPage: currentPage, onNavigate: onChangePage })))));
};
const OrgUnitsCell = ({ cell: { value, row } }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.row },
        React.createElement(OrgUnits, { units: value, icon: 'building' }),
        row.original.isAdmin && (React.createElement(Tooltip, { placement: "top", content: "Grafana Admin" },
            React.createElement(Icon, { name: "shield" })))));
};
const LicensedRoleCell = ({ cell: { value } }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null, value === 'None' ? (React.createElement("span", { className: styles.disabled },
        "Not assigned",
        ' ',
        React.createElement(Tooltip, { placement: "top", content: "A licensed role will be assigned when this user signs in" },
            React.createElement(Icon, { name: "question-circle" })))) : (value)));
};
const LastSeenAtCell = ({ cell: { value } }) => {
    const styles = useStyles2(getStyles);
    return React.createElement(React.Fragment, null, value && React.createElement(React.Fragment, null, value === '10 years' ? React.createElement("span", { className: styles.disabled }, "Never") : value));
};
const getStyles = (theme) => {
    return {
        disabled: css({ color: theme.colors.text.disabled }),
        row: css({
            display: 'flex',
            alignItems: 'center',
        }),
    };
};
//# sourceMappingURL=UsersTable.js.map