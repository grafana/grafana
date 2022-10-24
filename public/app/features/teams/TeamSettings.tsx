import React, { FC, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Input, Field, Form, Button, FieldSet, VerticalGroup } from '@grafana/ui';
import { TeamRolePicker } from 'app/core/components/RolePicker/TeamRolePicker';
import { updateTeamRoles } from 'app/core/components/RolePicker/api';
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

export const TeamSettings: FC<Props> = ({ team, updateTeam }) => {
  const canWriteTeamSettings = contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsWrite, team);
  const currentOrgId = contextSrv.user.orgId;

  const [{ roleOptions }] = useRoleOptions(currentOrgId);
  const [pendingRoles, setPendingRoles] = useState<Role[]>([]);

  const canUpdateRoles =
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd) &&
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove);

  return (
    <VerticalGroup spacing="lg">
      <Form
        defaultValues={{ ...team }}
        onSubmit={async (formTeam: Team) => {
          if (contextSrv.licensedAccessControlEnabled() && canUpdateRoles) {
            await updateTeamRoles(pendingRoles, team.id);
          }
          updateTeam(formTeam.name, formTeam.email);
        }}
        disabled={!canWriteTeamSettings}
      >
        {({ register, errors }) => (
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

            {contextSrv.licensedAccessControlEnabled() && (
              <Field label="Role">
                <TeamRolePicker
                  teamId={team.id}
                  roleOptions={roleOptions}
                  disabled={false}
                  apply={true}
                  onApplyRoles={setPendingRoles}
                  pendingRoles={pendingRoles}
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
        )}
      </Form>
      <SharedPreferences resourceUri={`teams/${team.id}`} disabled={!canWriteTeamSettings} />
    </VerticalGroup>
  );
};

export default connector(TeamSettings);
