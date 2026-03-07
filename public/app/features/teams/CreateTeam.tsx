import { JSX, useState } from 'react';
import { useForm } from 'react-hook-form';

import { locationUtil, NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Checkbox, Field, FieldSet, Input, Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { TeamRolePicker } from 'app/core/components/RolePicker/TeamRolePicker';
import { useRoleOptions } from 'app/core/components/RolePicker/hooks';
import { contextSrv } from 'app/core/services/context_srv';
import { Role } from 'app/types/accessControl';
import { TeamDTO } from 'app/types/teams';

import { getStatusCardProps, StepResultAlert, useCreateTeamOrchestrate } from './CreateTeamAPICalls';

const pageNav: NavModelItem = {
  icon: 'users-alt',
  id: 'team-new',
  text: 'New team',
  subTitle: 'Create a new team. Teams let you grant permissions to a group of users.',
};

const CreateTeam = (): JSX.Element => {
  const currentOrgId = contextSrv.user.orgId;

  const [pendingRoles, setPendingRoles] = useState<Role[]>([]);
  const [autocreateTeamFolder, setAutocreateTeamFolder] = useState(false);
  const [{ roleOptions }] = useRoleOptions(currentOrgId);
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<TeamDTO>();
  const { trigger, teamCreationStatus, folderCreationStatus, rolesCreationStatus } = useCreateTeamOrchestrate(
    pendingRoles,
    autocreateTeamFolder
  );

  // TODO: should we allow to click create again after error?
  const showCreateButton = !teamCreationStatus || teamCreationStatus?.state === 'error';
  const formLocked = !showCreateButton;

  return (
    <Page navId="teams" pageNav={pageNav}>
      <Page.Contents>
        <form onSubmit={handleSubmit(trigger)} style={{ maxWidth: '600px' }}>
          <FieldSet>
            <Stack direction="column" gap={2}>
              <Field
                noMargin
                label={t('teams.create-team.label-name', 'Name')}
                required
                invalid={!!errors.name}
                error="Team name is required"
              >
                <Input {...register('name', { required: true })} id="team-name" disabled={formLocked} />
              </Field>
              {contextSrv.licensedAccessControlEnabled() && (
                <Field noMargin label={t('teams.create-team.label-role', 'Role')}>
                  <TeamRolePicker
                    teamId={0}
                    roleOptions={roleOptions}
                    disabled={formLocked}
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
                  disabled={formLocked}
                  // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                  placeholder="email@test.com"
                />
              </Field>
              <Field noMargin>
                <Checkbox
                  value={autocreateTeamFolder}
                  label={t('teams.create-team.autocreate-team-folder', 'autocreate team folder')}
                  onChange={(event) => setAutocreateTeamFolder(event.currentTarget.checked)}
                  disabled={formLocked}
                />
              </Field>
            </Stack>
          </FieldSet>
          <Stack direction="column" gap={2}>
            {showCreateButton && (
              <Button type="submit" variant="primary">
                <Trans i18nKey="teams.create-team.create">Create</Trans>
              </Button>
            )}

            {/* Report team creation progress */}
            <Stack direction="column" gap={1}>
              {teamCreationStatus && (
                <StepResultAlert
                  {...getStatusCardProps(
                    teamCreationStatus,
                    'createFolder',
                    'data' in teamCreationStatus ? `/org/teams/edit/${teamCreationStatus.data}` : undefined
                  )}
                />
              )}
              {rolesCreationStatus && <StepResultAlert {...getStatusCardProps(rolesCreationStatus, 'createRoles')} />}
              {folderCreationStatus && (
                <StepResultAlert
                  {...getStatusCardProps(
                    folderCreationStatus,
                    'createFolder',

                    'data' in folderCreationStatus && folderCreationStatus.data
                      ? locationUtil.stripBaseFromUrl(folderCreationStatus.data)
                      : undefined
                  )}
                />
              )}
            </Stack>
          </Stack>
        </form>
      </Page.Contents>
    </Page>
  );
};

export default CreateTeam;
