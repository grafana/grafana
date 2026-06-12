import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { type FieldValues, type Path, type UseFormRegister } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Checkbox, ControlledCollapse, Field, Input, Stack } from '@grafana/ui';

interface Props<T extends FieldValues> {
  register: UseFormRegister<T>;
  nameTemplateName: Path<T>;
  enforceTemplateName: Path<T>;
}

/**
 * Branch naming options (RepositorySpec.branch / BranchOptions). These only
 * take effect for the branch (pull request) workflow on git-based repositories,
 * so the caller is responsible for only rendering it for those. The whole
 * section is gated behind the provisioning.gitConventions flag.
 */
export function BranchOptionsSection<T extends FieldValues>({
  register,
  nameTemplateName,
  enforceTemplateName,
}: Props<T>) {
  const gitConventionsEnabled = useBooleanFlagValue('provisioning.gitConventions', false);

  if (!gitConventionsEnabled) {
    return null;
  }

  return (
    <ControlledCollapse
      label={t('provisioning.branch-options.label-branch-options', 'Branch options')}
      isOpen={false}
    >
      <Stack direction="column" gap={2}>
        <Field
          noMargin
          label={t('provisioning.branch-options.label-name-template', 'Branch name template')}
          description={t(
            'provisioning.branch-options.description-name-template',
            'Template for the branch created by the branch (pull request) workflow. Available placeholders: {{actionVar}}, {{kindVar}}, {{titleVar}}, {{userLoginVar}}, {{randomVar}} (a short random token to avoid collisions). The result is sanitised into a valid Git branch name. Leave empty to use the auto-generated name.',
            {
              actionVar: '{{action}}',
              kindVar: '{{resourceKind}}',
              titleVar: '{{title}}',
              userLoginVar: '{{userLogin}}',
              randomVar: '{{random}}',
            }
          )}
        >
          <Input
            id="branch-name-template"
            {...register(nameTemplateName)}
            placeholder={t(
              'provisioning.branch-options.placeholder-name-template',
              'grafana/{{actionVar}}-{{titleVar}}-{{randomVar}}',
              { actionVar: '{{action}}', titleVar: '{{title}}', randomVar: '{{random}}' }
            )}
          />
        </Field>

        <Field noMargin>
          <Checkbox
            {...register(enforceTemplateName)}
            label={t('provisioning.branch-options.label-enforce-template', 'Enforce branch name template')}
            description={t(
              'provisioning.branch-options.description-enforce-template',
              'Make the branch name read-only in save dialogs so users cannot override the generated name.'
            )}
          />
        </Field>
      </Stack>
    </ControlledCollapse>
  );
}
