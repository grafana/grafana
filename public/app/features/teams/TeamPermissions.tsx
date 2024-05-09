import React from 'react';

// @todo: replace barrel import path
import { Permissions } from 'app/core/components/AccessControl/index';
import { contextSrv } from 'app/core/services/context_srv';

// @todo: replace barrel import path
import { AccessControlAction, Team } from '../../types/index';

type TeamPermissionsProps = {
  team: Team;
};

// TeamPermissions component replaces TeamMembers component when the accesscontrol feature flag is set
const TeamPermissions = (props: TeamPermissionsProps) => {
  const canSetPermissions = contextSrv.hasPermissionInMetadata(
    AccessControlAction.ActionTeamsPermissionsWrite,
    props.team
  );

  return (
    <Permissions
      title=""
      addPermissionTitle="Add member"
      buttonLabel="Add member"
      emptyLabel="There are no members in this team or you do not have the permissions to list the current members."
      resource="teams"
      resourceId={props.team.id}
      canSetPermissions={canSetPermissions}
    />
  );
};

export default TeamPermissions;
