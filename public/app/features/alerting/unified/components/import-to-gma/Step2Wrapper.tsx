import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';

import { useStepperState } from './Wizard/StepperState';
import { WizardStep } from './Wizard/WizardStep';
import { StepKey } from './Wizard/types';
import { Step2Content, useStep2Validation } from './steps/Step2AlertRules';
import { type ImportFormValues } from './types';

/**
 * Step 2 wrapper that uses the validation hook
 */
interface Step2WrapperProps {
  step1Completed: boolean;
  canImport: boolean;
  onNext: () => boolean;
  onSkip: () => void;
}

export function Step2Wrapper({ step1Completed, canImport, onNext, onSkip }: Step2WrapperProps) {
  const isStep2Valid = useStep2Validation(canImport);
  const { watch, setValue } = useFormContext<ImportFormValues>();
  const { setStepSkipped } = useStepperState();
  const [rulesSource, rulesDatasourceUID, rulesYamlFile] = watch([
    'rulesSource',
    'rulesDatasourceUID',
    'rulesYamlFile',
  ]);
  // No rules source chosen yet, so there is nothing to import. The other settings only shape an import
  // and don't count. As in step 1, only the selected source counts.
  const isEmpty = rulesSource === 'yaml' ? !rulesYamlFile : !rulesDatasourceUID;

  // While the step is empty it counts as skipped, so the sidebar lets the user jump to the review and
  // nothing from it is imported. Choosing a source turns that off again.
  useEffect(() => {
    setStepSkipped(StepKey.Rules, isEmpty);
    setValue('step2Skipped', isEmpty);
    if (isEmpty) {
      setValue('step2Completed', false);
    }
  }, [isEmpty, setStepSkipped, setValue]);

  return (
    <WizardStep
      stepId={StepKey.Rules}
      label={t('alerting.import-to-gma.step2.heading', 'Import rules')}
      subHeader={
        <Trans i18nKey="alerting.import-to-gma.step2.subtitle">
          Import alert rules and recording rules from an external source.
        </Trans>
      }
      onNext={onNext}
      onSkip={onSkip}
      // One button: it skips while no source is chosen and continues once one is. To move on without
      // importing rules, clear the source again.
      canSkip={false}
      skipLabel={t('alerting.import-to-gma.step2.skip', 'Skip')}
      disableNext={!isEmpty && !isStep2Valid}
      nextSkips={isEmpty}
    >
      <Step2Content step1Completed={step1Completed} canImport={canImport} />
    </WizardStep>
  );
}
