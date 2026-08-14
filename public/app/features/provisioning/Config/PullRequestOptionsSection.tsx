import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { type FieldValues, type Path, type UseFormRegister } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Checkbox, ControlledCollapse, Field, Input, Stack } from '@grafana/ui';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { checkImageRenderer, checkImageRenderingAllowed, checkPublicAccess } from '../GettingStarted/features';
import { type RepoType } from '../Wizard/types';
import { isGitHubBased } from '../utils/repositoryTypes';

import { DashboardPreviewField } from './DashboardPreviewField';

interface Props<T extends FieldValues> {
  register: UseFormRegister<T>;
  titleTemplateName: Path<T>;
  enforceTemplateName: Path<T>;
  /**
   * When set, render the dashboard previews toggle bound to this field. Previews
   * also require image rendering to be allowed and currently apply only to GitHub.
   */
  dashboardPreviewName?: Path<T>;
  /** Repository type; dashboard previews currently apply only to GitHub pull requests. */
  repoType?: RepoType;
}

/**
 * Pull request options (RepositorySpec.pullRequest / PullRequestOptions). Only
 * meaningful for providers that support pull/merge requests (GitHub, GitLab,
 * Bitbucket) — not the pure git type — so the caller is responsible for only
 * rendering it for those. The template fields are gated behind the
 * provisioning.gitConventions flag; the section still renders when the GitHub
 * dashboard previews toggle is shown.
 */
export function PullRequestOptionsSection<T extends FieldValues>({
  register,
  titleTemplateName,
  enforceTemplateName,
  dashboardPreviewName,
  repoType,
}: Props<T>) {
  const gitConventionsEnabled = useBooleanFlagValue('provisioning.gitConventions', false);
  // Previews are GitHub-only, so skip the settings query for other providers.
  const settings = useGetFrontendSettingsQuery(
    !dashboardPreviewName || !isGitHubBased(repoType) ? skipToken : undefined
  );

  // Dashboard previews currently apply only to GitHub and require image rendering to be allowed.
  const showDashboardPreviews = Boolean(
    isGitHubBased(repoType) && dashboardPreviewName && checkImageRenderingAllowed(settings.data)
  );

  if (!gitConventionsEnabled && !showDashboardPreviews) {
    return null;
  }

  return (
    <ControlledCollapse
      label={t('provisioning.pull-request-options.label-pull-request-options', 'Pull request options')}
      isOpen={false}
    >
      <Stack direction="column" gap={2}>
        {showDashboardPreviews && dashboardPreviewName && (
          <DashboardPreviewField
            register={register}
            name={dashboardPreviewName}
            disabled={!checkImageRenderer() || !checkPublicAccess()}
          />
        )}
        {gitConventionsEnabled && (
          <>
            <Field
              noMargin
              label={t('provisioning.pull-request-options.label-title-template', 'Pull request title template')}
              description={t(
                'provisioning.pull-request-options.description-title-template',
                'Template for the pull request title opened by the branch workflow. Available placeholders: {{actionVar}}, {{kindVar}}, {{titleVar}}, {{userLoginVar}}. Leave empty to use the first line of the commit message.',
                {
                  actionVar: '{{action}}',
                  kindVar: '{{resourceKind}}',
                  titleVar: '{{title}}',
                  userLoginVar: '{{userLogin}}',
                }
              )}
            >
              <Input
                id="pull-request-title-template"
                {...register(titleTemplateName)}
                placeholder={t(
                  'provisioning.pull-request-options.placeholder-title-template',
                  '{{actionVar}}: {{titleVar}}',
                  { actionVar: '{{action}}', titleVar: '{{title}}' }
                )}
              />
            </Field>

            <Field noMargin>
              <Checkbox
                {...register(enforceTemplateName)}
                label={t(
                  'provisioning.pull-request-options.label-enforce-template',
                  'Enforce pull request title template'
                )}
                description={t(
                  'provisioning.pull-request-options.description-enforce-template',
                  'Pre-fill the pull request title in save dialogs from the template above and make it read-only.'
                )}
              />
            </Field>
          </>
        )}
      </Stack>
    </ControlledCollapse>
  );
}
