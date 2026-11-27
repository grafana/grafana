import { isEqual, pick } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { type UseFormReturn, useWatch } from 'react-hook-form';

import { trackImportToGMAWizardStepSkipped } from '../../Analytics';

import { useStepperState } from './Wizard/StepperState';
import { StepKey } from './Wizard/types';
import { RULES_SPEC_FIELDS, type RulesSpecValues, buildRulesImportSpec } from './steps/utils';
import { type ImportFormValues, type RulesImportSpec } from './types';

/**
 * Step 2's Next and Skip handlers, and what the step imports once Next has validated it.
 * WizardStep and NextButton own the stepper state; these only update form values and say whether to proceed.
 */
export function useRulesStepNavigation({ control, trigger, getValues, setValue }: UseFormReturn<ImportFormValues>) {
  const { setStepCompleted } = useStepperState();
  const [validated, setValidated] = useState<{ values: RulesSpecValues; spec: RulesImportSpec }>();

  const onNext = useCallback(async (): Promise<boolean> => {
    const checkedFile = getValues('rulesYamlFile');
    // The file is checked when it is chosen, but that check is async and Next doesn't wait for it.
    if (getValues('rulesSource') === 'yaml' && !(await trigger('rulesYamlFile'))) {
      return false;
    }
    // A file chosen while the check ran hasn't been checked. Next has to be pressed again.
    if (getValues('rulesYamlFile') !== checkedFile) {
      return false;
    }
    const values = pick(getValues(), RULES_SPEC_FIELDS);
    const spec = buildRulesImportSpec(values);
    if (!spec) {
      return false;
    }
    setValidated({ values, spec });
    setValue('step2Completed', true);
    setValue('step2Skipped', false);
    return true;
  }, [trigger, getValues, setValue]);

  // An edit after Next makes the spec stale, so un-complete the step. Compared deeply because
  // useWatch returns copies of object fields.
  const liveValues = useWatch({ control, compute: (formValues) => pick(formValues, RULES_SPEC_FIELDS) });
  const isStale = validated !== undefined && !isEqual(validated.values, liveValues);
  const rulesSpec = isStale ? undefined : validated?.spec;
  useEffect(() => {
    if (isStale) {
      setValue('step2Completed', false);
      setStepCompleted(StepKey.Rules, false);
    }
  }, [isStale, setValue, setStepCompleted]);

  const onSkip = useCallback(() => {
    setValue('step2Completed', false);
    setValue('step2Skipped', true);
    setValidated(undefined);
    trackImportToGMAWizardStepSkipped({ step: 'rules' });
  }, [setValue]);

  return { rulesSpec, onNext, onSkip };
}
