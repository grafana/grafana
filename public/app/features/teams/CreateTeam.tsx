import React, { useEffect, useState } from 'react';

import { getBackendSrv, locationService } from '@grafana/runtime';
import { Button, Form, Field, Input, FieldSet } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { TeamRolePicker } from 'app/core/components/RolePicker/TeamRolePicker';
import { updateTeamRoles } from 'app/core/components/RolePicker/api';
import { useRoleOptions } from 'app/core/components/RolePicker/hooks';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, Role } from 'app/types';

interface TeamDTO {
  email: string;
  name: string;
}

export interface Props {}

export const CreateTeam = ({}: Props): JSX.Element => {
  const currentOrgId = contextSrv.user.orgId;
  const [pendingRoles, setPendingRoles] = useState<Role[]>([]);
  const [{ roleOptions }, setOrgId] = useRoleOptions(currentOrgId);

  const canUpdateRoles =
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd) &&
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove);

  useEffect(() => {
    setOrgId(currentOrgId);
  }, [currentOrgId, setOrgId]);

  const createTeam = async (formModel: TeamDTO) => {
    const newTeam = await getBackendSrv().post('/api/teams', formModel);
    if (newTeam.teamId) {
      try {
        await contextSrv.fetchUserPermissions();
        if (contextSrv.licensedAccessControlEnabled() && canUpdateRoles) {
          await updateTeamRoles(pendingRoles, newTeam.teamId, newTeam.orgId);
        }
      } catch (e) {
        console.log(e);
      }
      locationService.push(`/org/teams/edit/${newTeam.teamId}`);
    }
  };

  const onPendingRolesUpdate = (roles: Role[]) => {
    setPendingRoles(roles);
  };

  return (
    <Page navId="teams">
      <Page.Contents>
        <Form onSubmit={createTeam}>
          {({ register, errors }) => (
            <FieldSet label="New Team">
              <Field label="Name" required invalid={!!errors.name} error="Team name is required">
                <Input {...register('name', { required: true })} id="team-name" width={60} />
              </Field>
              {contextSrv.licensedAccessControlEnabled() && (
                <Field label="Role">
                  <TeamRolePicker
                    teamId={0}
                    roleOptions={roleOptions}
                    disabled={false}
                    apply={true}
                    onApplyRoles={onPendingRolesUpdate}
                    pendingRoles={pendingRoles}
                  />
                </Field>
              )}
              <Field
                label={'Email'}
                description={'This is optional and is primarily used for allowing custom team avatars.'}
              >
                <Input {...register('email')} type="email" id="team-email" placeholder="email@test.com" width={60} />
              </Field>
              <div className="gf-form-button-row">
                <Button type="submit" variant="primary">
                  Create
                </Button>
              </div>
            </FieldSet>
          )}
        </Form>
      </Page.Contents>
    </Page>
  );
};

export default CreateTeam;
