import { useCallback } from 'react';
import { type UseFormReturn } from 'react-hook-form';

import { trackImportToGMAWizardStepSkipped } from '../../Analytics';

import { type ImportFormValues } from './types';

/** Step 2's Next and Skip handlers. WizardStep and NextButton own the stepper state; these only update form values. */
export function useRulesStepNavigation({ trigger, getValues, setValue }: UseFormReturn<ImportFormValues>) {
  const onNext = useCallback(async (): Promise<boolean> => {
    // The file is checked when it is chosen, but that check is async and Next doesn't wait for it.
    if (getValues('rulesSource') === 'yaml' && !(await trigger('rulesYamlFile'))) {
      return false;
    }
    setValue('step2Completed', true);
    setValue('step2Skipped', false);
    return true;
  }, [trigger, getValues, setValue]);

  const onSkip = useCallback(() => {
    setValue('step2Completed', false);
    setValue('step2Skipped', true);
    trackImportToGMAWizardStepSkipped({ step: 'rules' });
  }, [setValue]);

  return { onNext, onSkip };
}
