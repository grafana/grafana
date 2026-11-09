import { useCallback, useEffect, useRef, useState } from 'react';
import { type UseFormReturn } from 'react-hook-form';
import { shallowEqual } from 'react-redux';

import { trackImportToGMAWizardStepSkipped } from '../../Analytics';

import { useStepperState } from './Wizard/StepperState';
import { isAutoSyncSelected } from './Wizard/steps';
import { StepKey } from './Wizard/types';
import { pickStep1Values } from './steps/utils';
import { type ImportFormValues, type Step1Values } from './types';
import { type Step1DryRun } from './useStep1DryRun';

/**
 * Step 1's Next, Skip and continue-while-locked handlers, and the snapshot of the values Next validated.
 * WizardStep and NextButton own the stepper state; these only update form values and say whether to proceed.
 */
export function useStep1Handlers(
  { trigger, getValues, setValue }: UseFormReturn<ImportFormValues>,
  {
    liveStep1Values,
    autoSyncIdentifier,
    checkNow,
  }: Pick<Step1DryRun, 'liveStep1Values' | 'autoSyncIdentifier' | 'checkNow'>
) {
  const { setStepCompleted } = useStepperState();
  const [validatedValues, setValidatedValues] = useState<Step1Values>();
  const autoFilledTreeRef = useRef('');

  // The checked values are snapshotted and are what the review and import steps use, so what we validate
  // is what we import.
  const onNext = useCallback(async (): Promise<boolean> => {
    // The name is checked on its own when the field loses focus. Clicking Next straight from the field
    // can get here before that check finishes, so run it again and wait for it.
    if (!(await trigger('policyTreeName'))) {
      return false;
    }
    const snapshot = pickStep1Values(getValues());
    if (!(await checkNow(snapshot))) {
      return false;
    }
    setValidatedValues(snapshot);
    setValue('step1Completed', true);
    setValue('step1Skipped', false);
    // Auto-sync names the tree itself; the disabled name field can still hold an earlier entry.
    const autoSyncSelected = isAutoSyncSelected(
      snapshot.autoSyncNotificationsEnabled ?? false,
      snapshot.notificationsSource
    );
    const createdTreeName = autoSyncSelected ? autoSyncIdentifier : snapshot.policyTreeName;
    // Replace only what this step filled in earlier, so a tree picked on the rules step is kept.
    const currentTree = getValues('selectedRoutingTree');
    if (createdTreeName && (!currentTree || currentTree === autoFilledTreeRef.current)) {
      setValue('selectedRoutingTree', createdTreeName);
      autoFilledTreeRef.current = createdTreeName;
    }
    return true;
  }, [trigger, checkNow, setValue, getValues, autoSyncIdentifier]);

  // An edit after Next makes the snapshot stale. Un-complete the step so the stepper can't jump
  // ahead to Review on values that were never validated.
  const isStale = validatedValues !== undefined && !shallowEqual(validatedValues, liveStep1Values);
  const step1Snapshot = isStale ? undefined : validatedValues;
  useEffect(() => {
    if (isStale) {
      setValue('step1Completed', false);
      setStepCompleted(StepKey.Notifications, false);
    }
  }, [isStale, setValue, setStepCompleted]);

  // A locked step has nothing to import, so moving on neither completes nor skips it. Both flags stay off:
  // notifications stay out of the import, and the later steps don't treat step 1 as skipped.
  const onContinueWhileLocked = useCallback((): boolean => {
    setValue('step1Completed', false);
    setValue('step1Skipped', false);
    setValue('selectedRoutingTree', '');
    autoFilledTreeRef.current = '';
    return true;
  }, [setValue]);

  const onSkip = useCallback(() => {
    setValue('step1Completed', false);
    setValue('step1Skipped', true);
    setValue('selectedRoutingTree', '');
    autoFilledTreeRef.current = '';
    setValidatedValues(undefined);
    trackImportToGMAWizardStepSkipped({ step: 'notifications' });
  }, [setValue]);

  return { step1Snapshot, onNext, onSkip, onContinueWhileLocked };
}
