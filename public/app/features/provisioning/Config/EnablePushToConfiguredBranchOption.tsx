import { FieldValues, UseFormRegister, Path } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Checkbox, Field } from '@grafana/ui';

export function EnablePushToConfiguredBranchOption<T extends FieldValues>({
  register,
  registerName,
  readOnly,
}: {
  register: UseFormRegister<T>;
  registerName: Path<T>;
  readOnly: boolean;
}) {
  return (
    <Field noMargin>
      <Checkbox
        disabled={readOnly}
        {...register(registerName)}
        label={t('provisioning.finish-step.enable-push-to-configured-branch-label', 'Enable push to configured branch')}
        description={t(
          'provisioning.config-form.description-enable-push-to-configured-branch',
          'Allow direct commits to the configured branch.'
        )}
      />
    </Field>
  );
}
