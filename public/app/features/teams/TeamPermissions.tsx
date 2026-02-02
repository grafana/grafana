import { Permissions } from 'app/core/components/AccessControl';
import { t } from 'app/core/internationalization';
// import { contextSrv } from 'app/core/services/context_srv';

import { Team } from '../../types';

type TeamPermissionsProps = {
  team: Team;
};

// TeamPermissions component replaces TeamMembers component when the accesscontrol feature flag is set
const TeamPermissions = (props: TeamPermissionsProps) => {
  // BMC Code: Comment below
  // const canSetPermissions = contextSrv.hasPermissionInMetadata(
  //   AccessControlAction.ActionTeamsPermissionsWrite,
  //   props.team
  // );

  return (
    // BMC code - changes for localization
    <Permissions
      title=""
      addPermissionTitle={t('bmcgrafana.team-permissions.add-member', 'Add member')}
      buttonLabel={t('bmcgrafana.team-permissions.add-member', 'Add member')}
      emptyLabel={t(
        'bmcgrafana.team-permissions.no-members-message',
        'There are no members in this team or you do not have the permissions to list the current members.'
      )}
      resource="teams"
      resourceId={props.team.id}
      canSetPermissions={false}
    />
  );
};

export default TeamPermissions;
