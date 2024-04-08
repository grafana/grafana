import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { connect, ConnectedProps } from 'react-redux';

import { Input, Field, Button, FieldSet, Stack } from '@grafana/ui';
import { RolePicker } from 'app/core/components/RolePicker/RolePicker';
import { fetchTeamRoles, updateTeamRoles } from 'app/core/components/RolePicker/api';
import { useRoleOptions } from 'app/core/components/RolePicker/hooks';
import { SharedPreferences } from 'app/core/components/SharedPreferences/SharedPreferences';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, Role, Team } from 'app/types';

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

  const [isLoading, setIsLoading] = useState(true);
  const [{ roleOptions }] = useRoleOptions(currentOrgId);
  const [pendingRoles, setPendingRoles] = useState<Role[]>([]);
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<Team>({ defaultValues: team });

  useEffect(() => {
    setIsLoading(true);
    fetchTeamRoles(team.id, team.orgId)
      .then((roles) => {
        setPendingRoles(roles);
        setIsLoading(false);
      })
      .catch((err) => {
        // todo
      });
  }, [team.id, team.orgId]);

  const canUpdateRoles =
    contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesAdd) &&
    contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesRemove);

  const canListRoles =
    contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsRolesList, team) &&
    contextSrv.hasPermission(AccessControlAction.ActionRolesList);

  const onSubmit = async (formTeam: Team) => {
    if (contextSrv.licensedAccessControlEnabled() && canUpdateRoles) {
      setIsLoading(true);
      await updateTeamRoles(pendingRoles, team.id);
      setIsLoading(false);
    }
    updateTeam(formTeam.name, formTeam.email || '');
  };

  return (
    <Stack direction={'column'} gap={3}>
      <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: '600px' }}>
        <FieldSet label="Team details">
          <Field
            label="Name"
            disabled={!canWriteTeamSettings}
            required
            invalid={!!errors.name}
            error="Name is required"
          >
            <Input {...register('name', { required: true })} id="name-input" />
          </Field>

          {contextSrv.licensedAccessControlEnabled() && canListRoles && (
            <Field label="Role">
              <RolePicker
                onSubmit={setPendingRoles}
                roles={pendingRoles}
                roleOptions={roleOptions}
                disabled={!canUpdateRoles}
                isLoading={isLoading}
                submitButtonText="Apply"
                maxWidth="100%"
              />
            </Field>
          )}

          <Field
            label="Email"
            description="This is optional and is primarily used to set the team profile avatar (via gravatar service)."
            disabled={!canWriteTeamSettings}
          >
            <Input {...register('email')} placeholder="team@email.com" type="email" id="email-input" />
          </Field>
          <Button type="submit" disabled={!canWriteTeamSettings}>
            Update
          </Button>
        </FieldSet>
      </form>
      <SharedPreferences resourceUri={`teams/${team.id}`} disabled={!canWriteTeamSettings} preferenceType="team" />
    </Stack>
  );
};

export default connector(TeamSettings);
