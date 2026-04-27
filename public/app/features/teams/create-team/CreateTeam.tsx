import { css } from '@emotion/css';
import { type JSX, useState } from 'react';
import { useForm } from 'react-hook-form';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import type { NavModelItem } from '@grafana/data/types';
import { locationUtil } from '@grafana/data/utils';
import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, Checkbox, Field, FieldSet, Input, Stack } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { Page } from '../../../core/components/Page/Page';
import { TeamRolePicker } from '../../../core/components/RolePicker/TeamRolePicker';
import { useRoleOptions } from '../../../core/components/RolePicker/hooks';
import { contextSrv } from '../../../core/services/context_srv';
import { type Role } from '../../../types/accessControl';
import { type TeamDTO } from '../../../types/teams';

import { getStatusCardProps, useCreateTeamOrchestrate } from './CreateTeamAPICalls';
import { StepResultAlert } from './StepResultAlert';

const pageNav: NavModelItem = {
  icon: 'users-alt',
  id: 'team-new',
  text: 'New team',
  subTitle: 'Create a new team. Teams let you grant permissions to a group of users.',
};

const CreateTeam = (): JSX.Element => {
  const currentOrgId = contextSrv.user.orgId;
  const styles = useStyles2(getStyles);

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

  async function submitFunction(data: TeamDTO) {
    const status = await trigger(data);
    // This should only ever report success or error as we won't return while something is loading.
    // If the user reloads or leaves the page in the middle, we may create a team without the report.
    reportInteraction('grafana_create_team_submit', {
      createTeam: status.teamCreationStatus?.state,
      createRoles: status.rolesCreationStatus?.state,
      createFolder: status.folderCreationStatus?.state,
    });
  }

  // We allow re-submitting the form if a team create step failed. This probably means nothing happened yet and the user
  // can try again. Also, the error can be that the team with a specific name already exists.
  const allowResubmit = !teamCreationStatus || teamCreationStatus?.state === 'error';
  const formDisabled = !allowResubmit;

  return (
    <Page navId="teams" pageNav={pageNav}>
      <Page.Contents>
        <form onSubmit={handleSubmit(submitFunction)} style={{ maxWidth: '600px' }}>
          <FieldSet>
            <Stack direction="column" gap={2}>
              <Field
                noMargin
                label={t('teams.create-team.label-name', 'Name')}
                required
                invalid={!!errors.name}
                error="Team name is required"
              >
                <Input {...register('name', { required: true })} id="team-name" disabled={formDisabled} />
              </Field>
              {contextSrv.licensedAccessControlEnabled() && (
                <Field noMargin label={t('teams.create-team.label-role', 'Role')}>
                  <TeamRolePicker
                    teamId={0}
                    roleOptions={roleOptions}
                    disabled={formDisabled}
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
                  disabled={formDisabled}
                  // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                  placeholder="email@test.com"
                />
              </Field>
              {config.featureToggles.teamFolders && (
                <Field
                  noMargin
                  label={t('teams.create-team.label-create-team-folder', 'Team folder')}
                  description={t(
                    'teams.create-team.description-create-team-folder',
                    'This creates a folder associated with the team, where users can add resources like dashboards and schedules with the right permissions.'
                  )}
                >
                  <Checkbox
                    value={autocreateTeamFolder}
                    label={t(
                      'teams.create-team.checkbox-text-create-team-folder-team-folder',
                      'Auto-create a team folder'
                    )}
                    onChange={(event) => setAutocreateTeamFolder(event.currentTarget.checked)}
                    disabled={formDisabled}
                  />
                </Field>
              )}
            </Stack>
          </FieldSet>
          <Button type="submit" variant="primary" disabled={formDisabled}>
            <Trans i18nKey="teams.create-team.create">Create</Trans>
          </Button>
          <div className={styles.statusSection}>
            <Stack direction="column" gap={2}>
              {/* Report team creation progress */}
              <Stack direction="column" gap={1}>
                {teamCreationStatus && (
                  <StepResultAlert
                    {...getStatusCardProps(
                      teamCreationStatus,
                      'createTeam',
                      'data' in teamCreationStatus && teamCreationStatus.data
                        ? `/org/teams/edit/${teamCreationStatus.data}`
                        : undefined
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
          </div>
        </form>
      </Page.Contents>
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  statusSection: css({
    marginTop: theme.spacing(2),
  }),
});

export default CreateTeam;
