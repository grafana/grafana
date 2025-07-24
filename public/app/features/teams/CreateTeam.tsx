import { JSX, useState } from 'react';
import { useForm } from 'react-hook-form';

import { NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { Button, Field, Input, FieldSet } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { TeamRolePicker } from 'app/core/components/RolePicker/TeamRolePicker';
import { updateTeamRoles } from 'app/core/components/RolePicker/api';
import { useRoleOptions } from 'app/core/components/RolePicker/hooks';
import { contextSrv } from 'app/core/core';
import { Role, AccessControlAction } from 'app/types/accessControl';
import { TeamDTO } from 'app/types/teams';

const pageNav: NavModelItem = {
  icon: 'users-alt',
  id: 'team-new',
  text: 'New team',
  subTitle: 'Create a new team. Teams let you grant permissions to a group of users.',
};

export const CreateTeam = (): JSX.Element => {
  const currentOrgId = contextSrv.user.orgId;
  const [pendingRoles, setPendingRoles] = useState<Role[]>([]);
  const [{ roleOptions }] = useRoleOptions(currentOrgId);
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<TeamDTO>();

  const canUpdateRoles =
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd) &&
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove);

  const createTeam = async (formModel: TeamDTO) => {
    const newTeam = await getBackendSrv().post('/api/teams', formModel);
    if (newTeam.teamId) {
      try {
        await contextSrv.fetchUserPermissions();
        if (contextSrv.licensedAccessControlEnabled() && canUpdateRoles) {
          await updateTeamRoles(pendingRoles, newTeam.teamId, newTeam.orgId);
        }
      } catch (e) {
        console.error(e);
      }
      locationService.push(`/org/teams/edit/${newTeam.uid}`);
    }
  };

  return (
    <Page navId="teams" pageNav={pageNav}>
      <Page.Contents>
        <form onSubmit={handleSubmit(createTeam)} style={{ maxWidth: '600px' }}>
          <FieldSet>
            <Field
              label={t('teams.create-team.label-name', 'Name')}
              required
              invalid={!!errors.name}
              error="Team name is required"
            >
              <Input {...register('name', { required: true })} id="team-name" />
            </Field>
            {contextSrv.licensedAccessControlEnabled() && (
              <Field label={t('teams.create-team.label-role', 'Role')}>
                <TeamRolePicker
                  teamId={0}
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
              label={t('teams.create-team.label-email', 'Email')}
              description={t(
                'teams.create-team.description-email',
                'This is optional and is primarily used for allowing custom team avatars'
              )}
            >
              {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
              <Input {...register('email')} type="email" id="team-email" placeholder="email@test.com" />
            </Field>
          </FieldSet>

          <Button type="submit" variant="primary">
            <Trans i18nKey="teams.create-team.create">Create</Trans>
          </Button>
        </form>
      </Page.Contents>
    </Page>
  );
};

export default CreateTeam;
