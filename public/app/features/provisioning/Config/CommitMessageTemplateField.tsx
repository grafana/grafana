import { type UseFormRegister } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field, Input } from '@grafana/ui';

import { type RepositoryFormData } from '../types';

interface Props {
  register: UseFormRegister<RepositoryFormData>;
}

export function CommitMessageTemplateField({ register }: Props) {
  return (
    <Field
      noMargin
      label={t('provisioning.config-form.label-commit-message-template', 'Commit message template')}
      description={t(
        'provisioning.config-form.description-commit-message-template',
        'Default commit message when saving a provisioned resource. Available placeholders: {{actionVar}} (create/update/delete/move/rename), {{kindVar}} (dashboard/folder), {{idVar}}, {{titleVar}}. Leave empty to use the built-in defaults.',
        {
          actionVar: '{{action}}',
          kindVar: '{{resourceKind}}',
          idVar: '{{resourceID}}',
          titleVar: '{{title}}',
        }
      )}
    >
      <Input
        id="commit-message-template"
        {...register('commit.singleResourceMessageTemplate')}
        placeholder={t(
          'provisioning.config-form.placeholder-commit-message-template',
          'feat(dashboards): {{actionVar}} {{titleVar}}',
          { actionVar: '{{action}}', titleVar: '{{title}}' }
        )}
      />
    </Field>
  );
}
