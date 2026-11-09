import { css } from '@emotion/css';
import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';

import { StagedImportSection } from '../../settings/import/StagedImportSection';

import {
  AutoSyncActiveNotice,
  ImportAPIDisabledNotice,
  type NotificationsLock,
  StagedConfigNotice,
} from './LockNotices';
import { useStepperState } from './Wizard/StepperState';
import { WizardStep } from './Wizard/WizardStep';
import { StepKey } from './Wizard/types';
import { Step1Content, useStep1Validation } from './steps/Step1AlertmanagerResources';
import { type DryRunState, type DryRunValidationResult, type ImportFormValues } from './types';

/**
 * Step 1 wrapper that uses the validation hook
 */
interface Step1WrapperProps {
  canImport: boolean;
  /** Set when notification configuration can't be imported at all; the step then only offers to continue */
  notificationsLock?: NotificationsLock;
  onNext: () => boolean | Promise<boolean>;
  onSkip: () => void;
  dryRunState: DryRunState;
  dryRunResult?: DryRunValidationResult;
  /** Locks the inputs so they can't change while Next's check is validating them. */
  isChecking: boolean;
}

const step1FieldsetStyle = css({ border: 0, margin: 0, padding: 0, minWidth: 0 });

export function Step1Wrapper({
  canImport,
  notificationsLock,
  onNext,
  onSkip,
  dryRunState,
  dryRunResult,
  isChecking,
}: Step1WrapperProps) {
  const isStep1Valid = useStep1Validation(canImport);
  const { watch, setValue } = useFormContext<ImportFormValues>();
  const { setStepSkipped } = useStepperState();
  const [
    autoSyncNotificationsEnabled,
    notificationsSource,
    notificationsYamlFile,
    notificationsTemplateFiles,
    notificationsDatasourceUID,
    policyTreeName,
  ] = watch([
    'autoSyncNotificationsEnabled',
    'notificationsSource',
    'notificationsYamlFile',
    'notificationsTemplateFiles',
    'notificationsDatasourceUID',
    'policyTreeName',
  ]);
  // Nothing entered yet, so there is nothing to validate and moving on is the same as skipping. Only the
  // selected source counts: a pick left behind under the other source is hidden and couldn't be cleared.
  const hasSourceInput =
    notificationsSource === 'yaml'
      ? Boolean(notificationsYamlFile) || notificationsTemplateFiles.length > 0
      : Boolean(notificationsDatasourceUID) || Boolean(autoSyncNotificationsEnabled);
  const isEmpty = !notificationsLock && !hasSourceInput && !policyTreeName;

  // While the step is empty it counts as skipped, so the sidebar lets the user jump ahead and nothing from
  // it is imported. Entering anything turns that off again, and the step has to be completed or skipped.
  useEffect(() => {
    if (notificationsLock) {
      return;
    }
    setStepSkipped(StepKey.Notifications, isEmpty);
    setValue('step1Skipped', isEmpty);
    if (isEmpty) {
      setValue('step1Completed', false);
    }
  }, [isEmpty, notificationsLock, setStepSkipped, setValue]);
  // Advance only once dry-run passes, auto-sync included: it checks the configuration before sync is turned on.

  return (
    <WizardStep
      stepId={StepKey.Notifications}
      label={t('alerting.import-to-gma.step1.heading', 'Import notification configuration')}
      subHeader={
        <Trans i18nKey="alerting.import-to-gma.step1.subtitle">
          Import contact points, notification policies, templates, and mute timings from an external Alertmanager.
        </Trans>
      }
      onNext={onNext}
      onSkip={onSkip}
      // One button: it skips while the step is empty and continues once something is entered. To move on
      // without importing what was entered, clear it again. A locked step only offers to continue.
      canSkip={false}
      skipLabel={t('alerting.import-to-gma.step1.skip', 'Skip')}
      // Next only needs the form to be valid. Clicking it runs a fresh dry run and stays on this step if
      // that fails (see handleStep1Next), so the live result shown here doesn't have to gate it.
      disableNext={!notificationsLock && !isEmpty && !isStep1Valid}
      nextSkips={isEmpty}
      disabledNextTooltip={t(
        'alerting.import-to-gma.step1.next-disabled-tooltip',
        'Complete the required fields before continuing.'
      )}
    >
      {notificationsLock === 'auto-sync' && <AutoSyncActiveNotice />}
      {notificationsLock === 'staged' && <StagedConfigNotice />}
      {notificationsLock === 'import-api-disabled' && <ImportAPIDisabledNotice />}
      {/* Nothing is staged here, so this only shows up if loading the staged copy failed. */}
      {!notificationsLock && <StagedImportSection />}
      {!notificationsLock && (
        <fieldset disabled={isChecking} className={step1FieldsetStyle}>
          <Step1Content canImport={canImport} dryRunState={dryRunState} dryRunResult={dryRunResult} />
        </fieldset>
      )}
    </WizardStep>
  );
}
