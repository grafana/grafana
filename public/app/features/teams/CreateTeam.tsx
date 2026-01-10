import { JSX, useState } from 'react';
import { useForm } from 'react-hook-form';

import { NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { Button, Field, Input, FieldSet, Stack, Checkbox, Alert } from '@grafana/ui';
import { extractErrorMessage } from 'app/api/utils';
import { Page } from 'app/core/components/Page/Page';
import { TeamRolePicker } from 'app/core/components/RolePicker/TeamRolePicker';
import { useRoleOptions } from 'app/core/components/RolePicker/hooks';
import { useAppNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import { Role } from 'app/types/accessControl';
import { TeamDTO } from 'app/types/teams';

import { useCreateTeam } from './hooks';

type NewTeamForm = TeamDTO & { createTeamFolder?: boolean };

export const CreateTeam = (): JSX.Element => {
  const pageNav: NavModelItem = {
    icon: 'users-alt',
    id: 'team-new',
    text: t('teams.create-team.page-title', 'New team'),
    subTitle: t(
      'teams.create-team.page-subtitle',
      'Create a new team. Teams let you grant permissions to a group of users.'
    ),
  };

  const teamFoldersEnabled = config.featureToggles.teamFolders;
  const showRolesPicker = contextSrv.licensedAccessControlEnabled();
  const currentOrgId = contextSrv.user.orgId;

  const notifyApp = useAppNotification();
  const [createTeamTrigger, createResponse] = useCreateTeam();
  const [pendingRoles, setPendingRoles] = useState<Role[]>([]);
  const [{ roleOptions }] = useRoleOptions(currentOrgId);
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<NewTeamForm>();

  const createTeam = async (formModel: NewTeamForm) => {
    try {
      const { data, error } = await createTeamTrigger(
        {
          email: formModel.email || '',
          name: formModel.name,
        },
        pendingRoles,
        formModel.createTeamFolder
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
                error={t('teams.create-team.error-name-required', 'Team name is required')}
              >
                <Input {...register('name', { required: true })} id="team-name" />
              </Field>
              {showRolesPicker && (
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
              {teamFoldersEnabled && (
                <Field
                  noMargin
                  label={t('teams.create-team.team-folder', 'Team folder')}
                  description={t(
                    'teams.create-team.description-team-folder',
                    'This creates a folder associated with the team, where users can add resources like dashboards and schedules with the right permissions.'
                  )}
                >
                  <Checkbox
                    {...register('createTeamFolder')}
                    id="team-folder"
                    label={t(
                      'teams.create-team.team-folder-label-autocreate-a-team-folder',
                      'Auto-create a team folder'
                    )}
                  />
                </Field>
              )}
            </Stack>
          </FieldSet>
          {Boolean(createResponse.error) && (
            <Alert title={t('teams.create-team.error-title', 'Error creating team')} severity="error">
              <Trans i18nKey="teams.create-team.error-message">
                We were unable to create your new team. Please try again later or contact support.
              </Trans>
              <br />
              <br />
              <div>{extractErrorMessage(createResponse.error)}</div>
            </Alert>
          )}
          <Button type="submit" variant="primary">
            <Trans i18nKey="teams.create-team.create">Create</Trans>
          </Button>
        </form>
      </Page.Contents>
    </Page>
  );
};

export default CreateTeam;
