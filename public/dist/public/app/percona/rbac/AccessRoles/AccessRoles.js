import React, { useCallback, useEffect, useMemo } from 'react';
import { LinkButton, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { loadUsers } from 'app/features/users/state/actions';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { fetchRolesAction } from 'app/percona/shared/core/reducers/roles/roles';
import { fetchUsersListAction } from 'app/percona/shared/core/reducers/users/users';
import { getPerconaSettings, getAccessRoles, getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';
import { Messages } from './AccessRole.messages';
import { getStyles } from './AccessRole.styles';
import { toAccessRoleRow, orderRole } from './AccessRole.utils';
import AccessRolesTable from './components/AccessRolesTable/AccessRolesTable';
const AccessRolesPage = () => {
    const dispatch = useAppDispatch();
    const { result: settings } = useSelector(getPerconaSettings);
    const { isLoading, roles } = useSelector(getAccessRoles);
    const rows = useMemo(
    // show default role first
    () => roles.map((role) => toAccessRoleRow(role, settings === null || settings === void 0 ? void 0 : settings.defaultRoleId)).sort(orderRole), [roles, settings === null || settings === void 0 ? void 0 : settings.defaultRoleId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const featureSelector = useCallback(getPerconaSettingFlag('enableAccessControl'), []);
    const styles = useStyles2(getStyles);
    useEffect(() => {
        dispatch(fetchRolesAction());
        dispatch(fetchUsersListAction());
        dispatch(loadUsers());
    }, [dispatch]);
    return (React.createElement(Page, { navId: "rbac-roles" },
        React.createElement(Page.Contents, { isLoading: isLoading },
            React.createElement(FeatureLoader, { featureSelector: featureSelector },
                React.createElement("h2", { "data-testid": "access-roles-title" }, Messages.title),
                React.createElement("p", { className: styles.description },
                    Messages.subtitle.text,
                    Messages.subtitle.further,
                    React.createElement("a", { className: styles.link, target: "_blank", rel: "noreferrer noopener", href: "https://per.co.na/roles_permissions" }, Messages.subtitle.link),
                    Messages.subtitle.dot),
                React.createElement("div", { className: styles.createContainer },
                    React.createElement(LinkButton, { href: "/roles/create", size: "md", variant: "primary", "data-testid": "access-roles-create-role" }, Messages.create)),
                React.createElement(AccessRolesTable, { items: rows })))));
};
export default AccessRolesPage;
//# sourceMappingURL=AccessRoles.js.map