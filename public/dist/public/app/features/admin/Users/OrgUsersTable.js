import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Button, ConfirmModal, Icon, Tooltip, useStyles2, Tag, InteractiveTable, Pagination, HorizontalGroup, VerticalGroup, Avatar, } from '@grafana/ui';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { fetchRoleOptions } from 'app/core/components/RolePicker/api';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
import AccessRoleCell from 'app/percona/rbac/AccessRoleCell';
import AccessRoleHeader from 'app/percona/rbac/AccessRoleHeader';
import { useAccessRolesEnabled } from 'app/percona/rbac/hooks/useAccessRolesEnabled';
import { AccessControlAction } from 'app/types';
import { OrgRolePicker } from '../OrgRolePicker';
const disabledRoleMessage = `This user's role is not editable because it is synchronized from your auth provider.
  Refer to the Grafana authentication docs for details.`;
const getBasicRoleDisabled = (user) => {
    let basicRoleDisabled = !contextSrv.hasPermissionInMetadata(AccessControlAction.OrgUsersWrite, user);
    let authLabel = Array.isArray(user.authLabels) && user.authLabels.length > 0 ? user.authLabels[0] : '';
    // A GCom specific feature toggle for role locking has been introduced, as the previous implementation had a bug with locking down external users synced through GCom (https://github.com/grafana/grafana/pull/72044)
    // Remove this conditional once FlagGcomOnlyExternalOrgRoleSync feature toggle has been removed
    if (authLabel !== 'grafana.com' || config.featureToggles.gcomOnlyExternalOrgRoleSync) {
        const isUserSynced = user === null || user === void 0 ? void 0 : user.isExternallySynced;
        basicRoleDisabled = isUserSynced || basicRoleDisabled;
    }
    return basicRoleDisabled;
};
const selectors = e2eSelectors.pages.UserListPage.UsersListPage;
export const OrgUsersTable = ({ users, orgId, onRoleChange, onRemoveUser, fetchData, changePage, page, totalPages, }) => {
    const [userToRemove, setUserToRemove] = useState(null);
    const [roleOptions, setRoleOptions] = useState([]);
    const styles = useStyles2(getStyles);
    // @PERCONA
    const accessRolesEnabled = useAccessRolesEnabled();
    useEffect(() => {
        function fetchOptions() {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    if (contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
                        let options = yield fetchRoleOptions(orgId);
                        setRoleOptions(options);
                    }
                }
                catch (e) {
                    console.error('Error loading options');
                }
            });
        }
        if (contextSrv.licensedAccessControlEnabled()) {
            fetchOptions();
        }
    }, [orgId]);
    // @ts-ignore
    const columns = useMemo(() => [
        {
            id: 'avatarUrl',
            header: '',
            cell: ({ cell: { value } }) => value && React.createElement(Avatar, { src: value, alt: "User avatar" }),
        },
        {
            id: 'login',
            header: 'Login',
            cell: ({ cell: { value } }) => React.createElement("div", null, value),
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
            id: 'lastSeenAtAge',
            header: 'Last active',
            cell: ({ cell: { value } }) => value,
            sortType: (a, b) => new Date(a.original.lastSeenAt).getTime() - new Date(b.original.lastSeenAt).getTime(),
        },
        {
            id: 'role',
            header: 'Role',
            cell: ({ cell: { value }, row: { original } }) => {
                const basicRoleDisabled = getBasicRoleDisabled(original);
                return contextSrv.licensedAccessControlEnabled() ? (React.createElement(UserRolePicker, { userId: original.userId, orgId: orgId, roleOptions: roleOptions, basicRole: value, onBasicRoleChange: (newRole) => onRoleChange(newRole, original), basicRoleDisabled: basicRoleDisabled, basicRoleDisabledMessage: disabledRoleMessage })) : (React.createElement(OrgRolePicker, { "aria-label": "Role", value: value, disabled: basicRoleDisabled, onChange: (newRole) => onRoleChange(newRole, original) }));
            },
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
            id: 'info',
            header: '',
            cell: InfoCell,
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
        {
            id: 'delete',
            header: '',
            cell: ({ row: { original } }) => {
                return (contextSrv.hasPermissionInMetadata(AccessControlAction.OrgUsersRemove, original) && (React.createElement(Button, { size: "sm", variant: "destructive", onClick: () => {
                        setUserToRemove(original);
                    }, icon: "times", "aria-label": `Delete user ${original.name}` })));
            },
        },
    ], [orgId, roleOptions, onRoleChange, accessRolesEnabled]);
    return (React.createElement(VerticalGroup, { spacing: "md", "data-testid": selectors.container },
        React.createElement("div", { className: styles.wrapper },
            React.createElement(InteractiveTable, { columns: columns, data: users, getRowId: (user) => String(user.userId), fetchData: fetchData }),
            React.createElement(HorizontalGroup, { justify: "flex-end" },
                React.createElement(Pagination, { onNavigate: changePage, currentPage: page, numberOfPages: totalPages, hideWhenSinglePage: true }))),
        Boolean(userToRemove) && (React.createElement(ConfirmModal, { body: `Are you sure you want to delete user ${userToRemove === null || userToRemove === void 0 ? void 0 : userToRemove.login}?`, confirmText: "Delete", title: "Delete", onDismiss: () => {
                setUserToRemove(null);
            }, isOpen: true, onConfirm: () => {
                if (!userToRemove) {
                    return;
                }
                onRemoveUser(userToRemove);
                setUserToRemove(null);
            } }))));
};
const InfoCell = ({ row: { original } }) => {
    const styles = useStyles2(getStyles);
    const basicRoleDisabled = getBasicRoleDisabled(original);
    return (basicRoleDisabled && (React.createElement("div", { className: styles.row },
        React.createElement(Tooltip, { content: disabledRoleMessage },
            React.createElement(Icon, { name: "question-circle", className: styles.icon })))));
};
const getStyles = (theme) => ({
    row: css({
        display: 'flex',
        alignItems: 'center',
    }),
    icon: css({
        marginLeft: theme.spacing(1),
    }),
    // Enable RolePicker overflow
    wrapper: css({
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'auto',
        overflowY: 'hidden',
        minHeight: '100vh',
        width: '100%',
        '& > div': {
            overflowX: 'unset',
            marginBottom: theme.spacing(2),
        },
    }),
});
//# sourceMappingURL=OrgUsersTable.js.map