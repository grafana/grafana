import { type FieldValues, type Path, type UseFormRegister } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Checkbox, ControlledCollapse, Field, Input, Stack } from '@grafana/ui';

interface Props<T extends FieldValues> {
  register: UseFormRegister<T>;
  messageTemplateName: Path<T>;
  enforceTemplateName: Path<T>;
}

/**
 * Advanced commit options (RepositorySpec.commit / CommitOptions). Collapsed by
 * default since the built-in defaults are sensible and most users won't change
 * them.
 */
export function CommitOptionsSection<T extends FieldValues>({
  register,
  messageTemplateName,
  enforceTemplateName,
}: Props<T>) {
  return (
    <ControlledCollapse
      label={t('provisioning.commit-options.label-commit-options', 'Commit options (advanced)')}
      isOpen={false}
    >
      <Stack direction="column" gap={2}>
        <Field
          noMargin
          label={t('provisioning.config-form.label-commit-message-template', 'Commit message template')}
          description={t(
            'provisioning.config-form.description-commit-message-template',
            'Default commit message when saving a provisioned resource. Available placeholders: {{actionVar}} (create/update/delete/move/rename), {{kindVar}} (dashboard/folder), {{idVar}}, {{titleVar}}, {{userNameVar}}, {{userLoginVar}}, {{userEmailVar}}. A "Grafana-saved-by: <name> (<login>)" trailer is appended automatically. Leave empty to use the built-in defaults.',
            {
              actionVar: '{{action}}',
              kindVar: '{{resourceKind}}',
              idVar: '{{resourceID}}',
              titleVar: '{{title}}',
              userNameVar: '{{userName}}',
              userLoginVar: '{{userLogin}}',
              userEmailVar: '{{userEmail}}',
            }
          )}
        >
          <Input
            id="commit-message-template"
            {...register(messageTemplateName)}
            placeholder={t(
              'provisioning.config-form.placeholder-commit-message-template',
              'feat(dashboards): {{actionVar}} {{titleVar}}',
              { actionVar: '{{action}}', titleVar: '{{title}}' }
            )}
          />
        </Field>

        <Field noMargin>
          <Checkbox
            {...register(enforceTemplateName)}
            label={t('provisioning.commit-options.label-enforce-template', 'Enforce commit message template')}
            description={t(
              'provisioning.commit-options.description-enforce-template',
              'Pre-fill the commit message in save dialogs from the template above and make it read-only. The "Grafana-saved-by" trailer is always appended.'
            )}
          />
        </Field>
      </Stack>
    </ControlledCollapse>
  );
}
