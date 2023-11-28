import { css, cx } from '@emotion/css';
import React, { memo } from 'react';
import { Button, HorizontalGroup, Icon, IconButton, useStyles2 } from '@grafana/ui';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { contextSrv } from 'app/core/core';
import { OrgRolePicker } from 'app/features/admin/OrgRolePicker';
import { AccessControlAction } from 'app/types';
const getServiceAccountsAriaLabel = (name) => {
    return `Edit service account's ${name} details`;
};
const ServiceAccountListItem = memo(({ serviceAccount, onRoleChange, roleOptions, onRemoveButtonClick, onDisable, onEnable, onAddTokenClick, }) => {
    const editUrl = `org/serviceaccounts/${serviceAccount.id}`;
    const styles = useStyles2(getStyles);
    const canUpdateRole = contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsWrite, serviceAccount);
    const displayRolePicker = contextSrv.hasPermission(AccessControlAction.ActionRolesList) &&
        contextSrv.hasPermission(AccessControlAction.ActionUserRolesList);
    return (React.createElement("tr", { key: serviceAccount.id, className: cx({ [styles.disabled]: serviceAccount.isDisabled }) },
        React.createElement("td", { className: "width-4 text-center link-td" },
            React.createElement("a", { href: editUrl, "aria-label": getServiceAccountsAriaLabel(serviceAccount.name) },
                React.createElement("img", { className: "filter-table__avatar", src: serviceAccount.avatarUrl, alt: `Avatar for user ${serviceAccount.name}` }))),
        React.createElement("td", { className: "link-td max-width-10" },
            React.createElement("a", { className: "ellipsis", href: editUrl, title: serviceAccount.name, "aria-label": getServiceAccountsAriaLabel(serviceAccount.name) }, serviceAccount.name)),
        React.createElement("td", { className: "link-td max-width-10" },
            React.createElement("a", { className: styles.accountId, href: editUrl, title: serviceAccount.login, "aria-label": getServiceAccountsAriaLabel(serviceAccount.name) }, serviceAccount.login)),
        contextSrv.licensedAccessControlEnabled() ? (React.createElement("td", null, displayRolePicker && (React.createElement(UserRolePicker, { userId: serviceAccount.id, orgId: serviceAccount.orgId, basicRole: serviceAccount.role, onBasicRoleChange: (newRole) => onRoleChange(newRole, serviceAccount), roleOptions: roleOptions, basicRoleDisabled: !canUpdateRole, disabled: serviceAccount.isDisabled })))) : (React.createElement("td", null,
            React.createElement(OrgRolePicker, { "aria-label": "Role", value: serviceAccount.role, disabled: !canUpdateRole || serviceAccount.isDisabled, onChange: (newRole) => onRoleChange(newRole, serviceAccount) }))),
        React.createElement("td", { className: "link-td max-width-10" },
            React.createElement("a", { className: "ellipsis", href: editUrl, title: "Tokens", "aria-label": getServiceAccountsAriaLabel(serviceAccount.name) },
                React.createElement("div", { className: cx(styles.tokensInfo, { [styles.tokensInfoSecondary]: !serviceAccount.tokens }) },
                    React.createElement("span", null,
                        React.createElement(Icon, { name: "key-skeleton-alt" })),
                    serviceAccount.tokens || 'No tokens'))),
        React.createElement("td", null,
            React.createElement(HorizontalGroup, { justify: "flex-end" },
                contextSrv.hasPermission(AccessControlAction.ServiceAccountsWrite) && !serviceAccount.tokens && (React.createElement(Button, { onClick: () => onAddTokenClick(serviceAccount), disabled: serviceAccount.isDisabled }, "Add token")),
                contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsWrite, serviceAccount) &&
                    (serviceAccount.isDisabled ? (React.createElement(Button, { variant: "primary", onClick: () => onEnable(serviceAccount) }, "Enable")) : (React.createElement(Button, { variant: "secondary", onClick: () => onDisable(serviceAccount) }, "Disable"))),
                contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsDelete, serviceAccount) && (React.createElement(IconButton, { className: styles.deleteButton, name: "trash-alt", size: "md", onClick: () => onRemoveButtonClick(serviceAccount), tooltip: `Delete service account ${serviceAccount.name}` }))))));
});
ServiceAccountListItem.displayName = 'ServiceAccountListItem';
const getStyles = (theme) => {
    return {
        iconRow: css `
      svg {
        margin-left: ${theme.spacing(0.5)};
      }
    `,
        accountId: cx('ellipsis', css `
        color: ${theme.colors.text.secondary};
      `),
        deleteButton: css `
      color: ${theme.colors.text.secondary};
    `,
        tokensInfo: css `
      span {
        margin-right: ${theme.spacing(1)};
      }
    `,
        tokensInfoSecondary: css `
      color: ${theme.colors.text.secondary};
    `,
        disabled: css `
      td a {
        color: ${theme.colors.text.secondary};
      }
    `,
    };
};
export default ServiceAccountListItem;
//# sourceMappingURL=ServiceAccountsListItem.js.map