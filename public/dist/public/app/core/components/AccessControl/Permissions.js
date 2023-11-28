import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import { sortBy } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Space } from '@grafana/experimental';
import { Button, useStyles2 } from '@grafana/ui';
import { SlideDown } from 'app/core/components/Animations/SlideDown';
import { Trans, t } from 'app/core/internationalization';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { DescendantCount } from 'app/features/browse-dashboards/components/BrowseActions/DescendantCount';
import { newBrowseDashboardsEnabled } from 'app/features/browse-dashboards/featureFlag';
import { AddPermission } from './AddPermission';
import { PermissionList } from './PermissionList';
import { PermissionTarget } from './types';
const EMPTY_PERMISSION = '';
const INITIAL_DESCRIPTION = {
    permissions: [],
    assignments: {
        teams: false,
        users: false,
        serviceAccounts: false,
        builtInRoles: false,
    },
};
export const Permissions = ({ title = t('access-control.permissions.title', 'Permissions'), buttonLabel = t('access-control.permissions.add-label', 'Add a permission'), emptyLabel = t('access-control.permissions.no-permissions', 'There are no permissions'), resource, resourceId, canSetPermissions, addPermissionTitle, }) => {
    const styles = useStyles2(getStyles);
    const [isAdding, setIsAdding] = useState(false);
    const [items, setItems] = useState([]);
    const [desc, setDesc] = useState(INITIAL_DESCRIPTION);
    const fetchItems = useCallback(() => {
        return getPermissions(resource, resourceId).then((r) => setItems(r));
    }, [resource, resourceId]);
    useEffect(() => {
        getDescription(resource).then((r) => {
            setDesc(r);
            return fetchItems();
        });
    }, [resource, resourceId, fetchItems]);
    const onAdd = (state) => {
        let promise = null;
        if (state.target === PermissionTarget.User) {
            promise = setUserPermission(resource, resourceId, state.userId, state.permission);
        }
        else if (state.target === PermissionTarget.ServiceAccount) {
            promise = setUserPermission(resource, resourceId, state.userId, state.permission);
        }
        else if (state.target === PermissionTarget.Team) {
            promise = setTeamPermission(resource, resourceId, state.teamId, state.permission);
        }
        else if (state.target === PermissionTarget.BuiltInRole) {
            promise = setBuiltInRolePermission(resource, resourceId, state.builtInRole, state.permission);
        }
        if (promise !== null) {
            promise.then(fetchItems);
        }
    };
    const onRemove = (item) => {
        let promise = null;
        if (item.userId) {
            promise = setUserPermission(resource, resourceId, item.userId, EMPTY_PERMISSION);
        }
        else if (item.teamId) {
            promise = setTeamPermission(resource, resourceId, item.teamId, EMPTY_PERMISSION);
        }
        else if (item.isServiceAccount && item.userId) {
            promise = setUserPermission(resource, resourceId, item.userId, EMPTY_PERMISSION);
        }
        else if (item.builtInRole) {
            promise = setBuiltInRolePermission(resource, resourceId, item.builtInRole, EMPTY_PERMISSION);
        }
        if (promise !== null) {
            promise.then(fetchItems);
        }
    };
    const onChange = (item, permission) => {
        if (item.permission === permission) {
            return;
        }
        if (item.userId) {
            onAdd({ permission, userId: item.userId, target: PermissionTarget.User });
        }
        else if (item.isServiceAccount) {
            onAdd({ permission, userId: item.userId, target: PermissionTarget.User });
        }
        else if (item.teamId) {
            onAdd({ permission, teamId: item.teamId, target: PermissionTarget.Team });
        }
        else if (item.builtInRole) {
            onAdd({ permission, builtInRole: item.builtInRole, target: PermissionTarget.BuiltInRole });
        }
    };
    const teams = useMemo(() => sortBy(items.filter((i) => i.teamId), ['team', 'isManaged']), [items]);
    const users = useMemo(() => sortBy(items.filter((i) => i.userId && !i.isServiceAccount), ['userLogin', 'isManaged']), [items]);
    const serviceAccounts = useMemo(() => sortBy(items.filter((i) => i.userId && i.isServiceAccount), ['userLogin', 'isManaged']), [items]);
    const builtInRoles = useMemo(() => sortBy(items.filter((i) => i.builtInRole), ['builtInRole', 'isManaged']), [items]);
    const titleRole = t('access-control.permissions.role', 'Role');
    const titleUser = t('access-control.permissions.user', 'User');
    const titleServiceAccount = t('access-control.permissions.serviceaccount', 'Service Account');
    const titleTeam = t('access-control.permissions.team', 'Team');
    return (React.createElement("div", null,
        canSetPermissions && (React.createElement(React.Fragment, null,
            newBrowseDashboardsEnabled() && resource === 'folders' && (React.createElement(React.Fragment, null,
                React.createElement(Trans, { i18nKey: "access-control.permissions.permissions-change-warning" }, "This will change permissions for this folder and all its descendants. In total, this will affect:"),
                React.createElement(DescendantCount, { selectedItems: {
                        folder: { [resourceId]: true },
                        dashboard: {},
                        panel: {},
                        $all: false,
                    } }),
                React.createElement(Space, { v: 2 }))),
            React.createElement(Button, { className: styles.addPermissionButton, variant: 'primary', key: "add-permission", onClick: () => setIsAdding(true) }, buttonLabel),
            React.createElement(SlideDown, { in: isAdding },
                React.createElement(AddPermission, { title: addPermissionTitle, onAdd: onAdd, permissions: desc.permissions, assignments: desc.assignments, onCancel: () => setIsAdding(false) })))),
        items.length === 0 && (React.createElement("table", { className: "filter-table gf-form-group" },
            React.createElement("tbody", null,
                React.createElement("tr", null,
                    React.createElement("th", null, emptyLabel))))),
        React.createElement(PermissionList, { title: titleRole, items: builtInRoles, compareKey: 'builtInRole', permissionLevels: desc.permissions, onChange: onChange, onRemove: onRemove, canSet: canSetPermissions }),
        React.createElement(PermissionList, { title: titleUser, items: users, compareKey: 'userLogin', permissionLevels: desc.permissions, onChange: onChange, onRemove: onRemove, canSet: canSetPermissions }),
        React.createElement(PermissionList, { title: titleServiceAccount, items: serviceAccounts, compareKey: 'userLogin', permissionLevels: desc.permissions, onChange: onChange, onRemove: onRemove, canSet: canSetPermissions }),
        React.createElement(PermissionList, { title: titleTeam, items: teams, compareKey: 'team', permissionLevels: desc.permissions, onChange: onChange, onRemove: onRemove, canSet: canSetPermissions })));
};
const getDescription = (resource) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield getBackendSrv().get(`/api/access-control/${resource}/description`);
    }
    catch (e) {
        console.error('failed to load resource description: ', e);
        return INITIAL_DESCRIPTION;
    }
});
const getPermissions = (resource, resourceId) => getBackendSrv().get(`/api/access-control/${resource}/${resourceId}`);
const setUserPermission = (resource, resourceId, userId, permission) => setPermission(resource, resourceId, 'users', userId, permission);
const setTeamPermission = (resource, resourceId, teamId, permission) => setPermission(resource, resourceId, 'teams', teamId, permission);
const setBuiltInRolePermission = (resource, resourceId, builtInRole, permission) => setPermission(resource, resourceId, 'builtInRoles', builtInRole, permission);
const setPermission = (resource, resourceId, type, typeId, permission) => getBackendSrv().post(`/api/access-control/${resource}/${resourceId}/${type}/${typeId}`, { permission });
const getStyles = (theme) => ({
    breakdown: css(Object.assign(Object.assign({}, theme.typography.bodySmall), { color: theme.colors.text.secondary, marginBottom: theme.spacing(2) })),
    addPermissionButton: css({
        marginBottom: theme.spacing(2),
    }),
});
//# sourceMappingURL=Permissions.js.map