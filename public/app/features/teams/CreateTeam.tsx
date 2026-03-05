import { JSX, useState } from 'react';
import { useForm } from 'react-hook-form';

import { NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { Button, Field, Input, FieldSet, Stack } from '@grafana/ui';
import { extractErrorMessage } from 'app/api/utils';
import { Page } from 'app/core/components/Page/Page';
import { TeamRolePicker } from 'app/core/components/RolePicker/TeamRolePicker';
import { useRoleOptions } from 'app/core/components/RolePicker/hooks';
import { AssignRoles } from 'app/core/components/RolePickerDrawer/AssignRoles';
import { useAppNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import { Role, AccessControlAction } from 'app/types/accessControl';
import { TeamDTO } from 'app/types/teams';

import { useCreateTeam } from './hooks';

const pageNav: NavModelItem = {
  icon: 'users-alt',
  id: 'team-new',
  text: 'New team',
  subTitle: 'Create a new team. Teams let you grant permissions to a group of users.',
};

const CreateTeam = (): JSX.Element => {
  const currentOrgId = contextSrv.user.orgId;

  const notifyApp = useAppNotification();
  const [createTeamTrigger] = useCreateTeam();
  const [pendingRoles, setPendingRoles] = useState<Role[]>([]);
  const [{ roleOptions }] = useRoleOptions(currentOrgId);
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<TeamDTO>();

  const canUpdateTeamRoles =
    contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesAdd) &&
    contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesRemove);

  const handleInlineChange = (newRoles: Role[]) => {
    setPendingRoles(newRoles);
  };

  const createTeam = async (formModel: TeamDTO) => {
    try {
      const { data, error } = await createTeamTrigger(
        {
          email: formModel.email || '',
          name: formModel.name,
        },
        pendingRoles
      );

      const errorMessage = error ? extractErrorMessage(error) : undefined;

      if (errorMessage) {
        notifyApp.error(errorMessage);
        return;
      }

      if (data && data.uid) {
        locationService.push(`/org/teams/edit/${data.uid}`);
      }
    } catch (e) {
      notifyApp.error(t('teams.create-team.failed-to-create', 'Failed to create team'));
      console.error(e);
    }
  };

  return (
    <Page navId="teams" pageNav={pageNav}>
      <Page.Contents>
        <form onSubmit={handleSubmit(createTeam)} style={{ maxWidth: '600px' }}>
          <FieldSet>
            <Stack direction="column" gap={2}>
              <Field
                noMargin
                label={t('teams.create-team.label-name', 'Name')}
                required
                invalid={!!errors.name}
                error="Team name is required"
              >
                <Input {...register('name', { required: true })} id="team-name" />
              </Field>
              {contextSrv.licensedAccessControlEnabled() && (
                config.featureToggles.rolePickerDrawer ? (
                  <AssignRoles
                    appliedRoles={[]}
                    roleOptions={roleOptions}
                    canUpdateRoles={canUpdateTeamRoles}
                    onChange={handleInlineChange}
                  />
                ) : (
                  <Field noMargin label={t('teams.create-team.label-role', 'Role')}>
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
                )
              )}
              <Field
                noMargin
                label={t('teams.create-team.label-email', 'Email')}
                description={t(
                  'teams.create-team.description-email',
                  'This is optional and is primarily used for allowing custom team avatars'
                )}
              >
                <Input
                  {...register('email')}
                  type="email"
                  id="team-email"
                  // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                  placeholder="email@test.com"
                />
              </Field>
            </Stack>
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
