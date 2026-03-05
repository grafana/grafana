import { FieldValues, UseFormRegister, Path } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Checkbox, Field, Tooltip } from '@grafana/ui';

interface EnablePushToConfiguredBranchOptionProps<T extends FieldValues> {
  register: UseFormRegister<T>;
  registerName: Path<T>;
  readOnly: boolean;
  branchIsProtected?: boolean;
  currentValue?: boolean;
}

export function EnablePushToConfiguredBranchOption<T extends FieldValues>({
  register,
  registerName,
  readOnly,
  branchIsProtected = false,
  currentValue = false,
}: EnablePushToConfiguredBranchOptionProps<T>) {
  // Allow unchecking even when the branch is protected so users can fix misconfiguration
  const isDisabledByProtection = branchIsProtected && !currentValue;
  const isDisabled = readOnly || isDisabledByProtection;

  const checkbox = (
    <Field noMargin>
      <Checkbox
        disabled={isDisabled}
        {...register(registerName)}
        label={t('provisioning.enable-push-to-configured-branch-label', 'Enable push to synchronized branch')}
        description={t(
          'provisioning.enable-push-to-configured-branch-description',
          'Allow direct commits to the synchronized branch.'
        )}
      />
    </Field>
  );

  if (isDisabledByProtection) {
    return (
      <Tooltip
        content={t(
          'provisioning.enable-push-to-configured-branch-protected-tooltip',
          'Push to synchronized branch is not available because the configured branch is protected.'
        )}
      >
        <div>{checkbox}</div>
      </Tooltip>
    );
  }

  return checkbox;
}
