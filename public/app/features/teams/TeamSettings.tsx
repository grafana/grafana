import { useForm } from 'react-hook-form';
import { ConnectedProps, connect } from 'react-redux';

import { Button, Field, FieldSet, Input, Stack } from '@grafana/ui';
import { TeamRolePicker } from 'app/core/components/RolePicker/TeamRolePicker';
import { useRoleOptions } from 'app/core/components/RolePicker/hooks';
import { SharedPreferences } from 'app/core/components/SharedPreferences/SharedPreferences';
import { config } from 'app/core/config';
import { t } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, Team } from 'app/types';

import { updateTeam } from './state/actions';

const mapDispatchToProps = {
  updateTeam,
};

const connector = connect(null, mapDispatchToProps);

interface OwnProps {
  team: Team;
}
export type Props = ConnectedProps<typeof connector> & OwnProps;

export const TeamSettings = ({ team, updateTeam }: Props) => {
  const canWriteTeamSettings = contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsWrite, team);
  const currentOrgId = contextSrv.user.orgId;

  const [{ roleOptions }] = useRoleOptions(currentOrgId);
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<Team>({ defaultValues: team });

  const canUpdateRoles =
    contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesAdd) &&
    contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesRemove);

  const canListRoles =
    contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsRolesList, team) &&
    contextSrv.hasPermission(AccessControlAction.ActionRolesList);

  const onSubmit = async (formTeam: Team) => {
    updateTeam(formTeam.name, formTeam.email || '');
  };

  return (
    <Stack direction={'column'} gap={3}>
      <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: '600px' }}>
        {/* BMC Change: Next line inline for localized label */}
        <FieldSet label={t('bmcgrafana.users-and-access.team.details.title', 'Team details')}>
          <Field label="Numerical identifier" disabled={true}>
            <Input value={team.id} id="id-input" />
          </Field>
          <Field
            // BMC Change - Next couple line inline
            label={t('bmcgrafana.users-and-access.headers.name-text', 'Name')}
            disabled={!canWriteTeamSettings || config.buildInfo.env !== 'development'}
            required
            invalid={!!errors.name}
            error="Name is required"
          >
            <Input {...register('name', { required: true })} id="name-input" />
          </Field>

          {contextSrv.licensedAccessControlEnabled() && canListRoles && (
            <Field label="Role">
              <TeamRolePicker 
                teamId={team.id}
                roleOptions={roleOptions}
                disabled={!canUpdateRoles || config.buildInfo.env !== 'development'}
                maxWidth="100%" />
            </Field>
          )}

          <Field
            label={t('bmcgrafana.users-and-access.headers.email-text', 'Email')}
            description={t(
              'bmcgrafana.users-and-access.team.details.email-description-text',
              'This is optional and is primarily used to set the team profile avatar (via gravatar service).'
            )}
            // BMC Change - Next Inline
            disabled={!canWriteTeamSettings || config.buildInfo.env !== 'development'}
          >
            <Input {...register('email')} placeholder="team@email.com" type="email" id="email-input" />
          </Field>
          {/* BMC Change: Hide save button */}
          {config.buildInfo.env === 'development' && (
            <Button type="submit" disabled={!canWriteTeamSettings}>
              Save
            </Button>
          )}
        </FieldSet>
      </form>
      <SharedPreferences resourceUri={`teams/${team.id}`} disabled={!canWriteTeamSettings} preferenceType="team" />
    </Stack>
  );
};

export default connector(TeamSettings);
