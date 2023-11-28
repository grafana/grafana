import React from 'react';
import { Permissions } from 'app/core/components/AccessControl';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from '../../types';
// TeamPermissions component replaces TeamMembers component when the accesscontrol feature flag is set
const TeamPermissions = (props) => {
    const canSetPermissions = contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsPermissionsWrite, props.team);
    return (React.createElement(Permissions, { title: "", addPermissionTitle: "Add member", buttonLabel: "Add member", emptyLabel: "There are no members in this team or you do not have the permissions to list the current members.", resource: "teams", resourceId: props.team.id, canSetPermissions: canSetPermissions }));
};
export default TeamPermissions;
//# sourceMappingURL=TeamPermissions.js.map