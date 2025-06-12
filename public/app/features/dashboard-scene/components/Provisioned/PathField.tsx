import { memo } from 'react';
import { useFormContext } from 'react-hook-form';

import { useTranslate } from '@grafana/i18n';
import { Field, Input } from '@grafana/ui';

interface PathFieldProps {
  readOnly?: boolean;
}

/**
 * @description
 * PathField component for the Save/Delete Provisioned Dashboard form. This component renders an input field
 * for the file path inside the repository where the dashboard will be saved or deleted.
 */

export const PathField = memo<PathFieldProps>(({ readOnly = false }) => {
  const { register } = useFormContext();
  const { t } = useTranslate();

  return (
    <Field
      noMargin
      label={t('dashboard-scene.save-provisioned-dashboard-form.label-path', 'Path')}
      description={t(
        'dashboard-scene.save-provisioned-dashboard-form.description-inside-repository',
        'File path inside the repository (.json or .yaml)'
      )}
    >
      <Input id="dashboard-path" {...register('path')} readOnly={readOnly} />
    </Field>
  );
});
