import { memo } from 'react';
import { useFormContext } from 'react-hook-form';

import { useTranslate } from '@grafana/i18n';
import { Field, TextArea } from '@grafana/ui';

interface CommentFieldProps {
  disabled?: boolean;
}

export const CommentField = memo<CommentFieldProps>(({ disabled = false }) => {
  const { register } = useFormContext();
  const { t } = useTranslate();

  return (
    <Field noMargin label={t('dashboard-scene.save-provisioned-dashboard-form.label-comment', 'Comment')}>
      <TextArea
        id="dashboard-comment"
        {...register('comment')}
        disabled={disabled}
        placeholder={t(
          'dashboard-scene.save-provisioned-dashboard-form.dashboard-comment-placeholder-describe-changes-optional',
          'Add a note to describe your changes (optional)'
        )}
        rows={5}
      />
    </Field>
  );
});
