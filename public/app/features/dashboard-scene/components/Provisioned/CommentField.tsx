import { memo } from 'react';
import { useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field, TextArea } from '@grafana/ui';

import { ProvisionedDashboardFormData } from '../../saving/shared';

interface CommentFieldProps {
  disabled?: boolean;
}

/**
 * @description
 * CommentField component for the Save/Delete Provisioned Dashboard form.
 */

export const CommentField = memo<CommentFieldProps>(({ disabled = false }) => {
  const { register } = useFormContext();
  const fieldName: keyof ProvisionedDashboardFormData = 'comment';

  return (
    <Field noMargin label={t('dashboard-scene.save-or-delete-provisioned-dashboard-form.label-comment', 'Comment')}>
      <TextArea
        id="dashboard-comment"
        {...register(fieldName)}
        disabled={disabled}
        placeholder={t(
          'dashboard-scene.save-or-delete-provisioned-dashboard-form.dashboard-comment-placeholder-describe-changes-optional',
          'Add a note to describe your changes (optional)'
        )}
        rows={5}
      />
    </Field>
  );
});
