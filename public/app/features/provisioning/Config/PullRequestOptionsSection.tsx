import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { type ReactNode } from 'react';
import { type FieldValues, type Path, type UseFormRegister } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Checkbox, ControlledCollapse, Field, Input, Stack } from '@grafana/ui';

interface Props<T extends FieldValues> {
  register: UseFormRegister<T>;
  titleTemplateName: Path<T>;
  enforceTemplateName: Path<T>;
  /** Provider-specific pull request options (e.g. GitHub dashboard previews) rendered above the template fields. */
  children?: ReactNode;
}

/**
 * Pull request options (RepositorySpec.pullRequest / PullRequestOptions). Only
 * meaningful for providers that support pull/merge requests (GitHub, GitLab,
 * Bitbucket) — not the pure git type — so the caller is responsible for only
 * rendering it for those. The template fields are gated behind the
 * provisioning.gitConventions flag; the section still renders when provider-specific
 * children (e.g. GitHub dashboard previews) are provided.
 */
export function PullRequestOptionsSection<T extends FieldValues>({
  register,
  titleTemplateName,
  enforceTemplateName,
  children,
}: Props<T>) {
  const gitConventionsEnabled = useBooleanFlagValue('provisioning.gitConventions', false);

  if (!gitConventionsEnabled && !children) {
    return null;
  }

  return (
    <ControlledCollapse
      label={t('provisioning.pull-request-options.label-pull-request-options', 'Pull request options')}
      isOpen={false}
    >
      <Stack direction="column" gap={2}>
        {children}
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
