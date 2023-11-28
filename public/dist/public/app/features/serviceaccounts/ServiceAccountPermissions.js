import React from 'react';
import { Permissions } from 'app/core/components/AccessControl';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from '../../types';
export const ServiceAccountPermissions = (props) => {
    const canSetPermissions = contextSrv.hasPermissionInMetadata(AccessControlAction.ServiceAccountsPermissionsWrite, props.serviceAccount);
    return (React.createElement(Permissions, { title: "Permissions", addPermissionTitle: "Add permission", buttonLabel: "Add permission", resource: "serviceaccounts", resourceId: props.serviceAccount.id, canSetPermissions: canSetPermissions }));
};
//# sourceMappingURL=ServiceAccountPermissions.js.map