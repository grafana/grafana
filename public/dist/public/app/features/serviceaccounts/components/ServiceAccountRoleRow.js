import React from 'react';
import { Label } from '@grafana/ui';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { contextSrv } from 'app/core/core';
import { OrgRolePicker } from 'app/features/admin/OrgRolePicker';
import { AccessControlAction } from 'app/types';
export const ServiceAccountRoleRow = ({ label, serviceAccount, roleOptions, onRoleChange }) => {
    const inputId = `${label}-input`;
    const canUpdateRole = contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsWrite, serviceAccount);
    return (React.createElement("tr", null,
        React.createElement("td", null,
            React.createElement(Label, { htmlFor: inputId }, label)),
        contextSrv.licensedAccessControlEnabled() ? (React.createElement("td", { colSpan: 3 },
            React.createElement(UserRolePicker, { userId: serviceAccount.id, orgId: serviceAccount.orgId, basicRole: serviceAccount.role, onBasicRoleChange: onRoleChange, roleOptions: roleOptions, basicRoleDisabled: !canUpdateRole, disabled: serviceAccount.isDisabled }))) : (React.createElement(React.Fragment, null,
            React.createElement("td", null,
                React.createElement(OrgRolePicker, { width: 24, inputId: inputId, "aria-label": "Role", value: serviceAccount.role, disabled: serviceAccount.isDisabled, onChange: onRoleChange })),
            React.createElement("td", { colSpan: 2 })))));
};
//# sourceMappingURL=ServiceAccountRoleRow.js.map