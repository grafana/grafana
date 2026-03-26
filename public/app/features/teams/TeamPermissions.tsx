import { config } from '@grafana/runtime';
import { Permissions } from 'app/core/components/AccessControl/Permissions';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { Team } from 'app/types/teams';

import { TeamBindingPermissions } from './TeamBindingPermissions';

type TeamPermissionsProps = {
  team: Team;
};

// TeamPermissions component replaces TeamMembers component when the accesscontrol feature flag is set
const TeamPermissions = (props: TeamPermissionsProps) => {
  let canSetPermissions = contextSrv.hasPermissionInMetadata(
    AccessControlAction.ActionTeamsPermissionsWrite,
    props.team
  );

  if (props.team.isProvisioned) {
    canSetPermissions = false;
  }

  if (config.featureToggles.kubernetesTeamsRedirect) {
    return (
      <TeamBindingPermissions
        teamName={props.team.uid}
        canSetPermissions={canSetPermissions}
      />
    );
  }

  return (
    <Permissions
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
