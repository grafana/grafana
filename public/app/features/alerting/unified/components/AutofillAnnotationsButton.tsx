import { useCallback } from 'react';
import { useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import { type RuleFormValues } from '../types/rule-form';
import { clearRequiredAnnotationValidationErrors, ensureAlertAnnotations } from '../utils/alert-annotations';
import { isCloudAlertingRuleByType, isGrafanaAlertingRuleByType } from '../utils/rules';

export function AutofillAnnotationsButton() {
  const { getValues, setValue, clearErrors, watch } = useFormContext<RuleFormValues>();
  const type = watch('type');

  const onAutofill = useCallback(() => {
    const values = getValues();
    const enrichedValues = ensureAlertAnnotations(values);

    if (enrichedValues.annotations !== values.annotations) {
      setValue('annotations', enrichedValues.annotations, { shouldDirty: true, shouldValidate: true });
    }

    clearRequiredAnnotationValidationErrors(enrichedValues.annotations, clearErrors);
  }, [clearErrors, getValues, setValue]);

  if (!isGrafanaAlertingRuleByType(type) && !isCloudAlertingRuleByType(type)) {
    return null;
  }

  return (
    <Button type="button" variant="secondary" onClick={onAutofill}>
      {t('alerting.annotations.autofill', 'Autofill')}
    </Button>
  );
}
