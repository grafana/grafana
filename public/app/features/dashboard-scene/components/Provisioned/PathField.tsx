import { memo } from 'react';
import { useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field, Input } from '@grafana/ui';

import { ProvisionedDashboardFormData } from '../../saving/shared';

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
  const fieldName: keyof ProvisionedDashboardFormData = 'path';

  return (
    <Field
      noMargin
      label={t('dashboard-scene.save-or-delete-provisioned-dashboard-form.label-path', 'Path')}
      description={t(
        'dashboard-scene.save-or-delete-provisioned-dashboard-form.description-inside-repository',
        'File path inside the repository (.json or .yaml)'
      )}
    >
      <Input id="dashboard-path" type="text" {...register(fieldName)} readOnly={readOnly} />
    </Field>
  );
});
