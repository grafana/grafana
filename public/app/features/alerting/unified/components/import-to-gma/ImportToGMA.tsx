import { useCallback, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { useFlagAlertingImportAlertmanagerAPI } from '@grafana/runtime/internal';
import { LoadingPlaceholder } from '@grafana/ui';

import { trackImportToGMAWizardStarted } from '../../Analytics';
import { useIsAutoSyncActive } from '../../hooks/useIsAutoSyncActive';
import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { getAlertRulesNavId } from '../../navigation/useAlertRulesNav';
import { useStagedConfig } from '../../settings/import/useStagedConfig';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertingPageWrapper } from '../AlertingPageWrapper';

import { ConfirmImportModal } from './ConfirmImportModal';
import { type NotificationsLock } from './LockNotices';
import { Step1Wrapper } from './Step1Wrapper';
import { Step2Wrapper } from './Step2Wrapper';
import { StepperStateProvider, useStepperState } from './Wizard/StepperState';
import { WizardLayout } from './Wizard/WizardLayout';
import { getImportPlan } from './Wizard/steps';
import { StepKey } from './Wizard/types';
import { useRulesToImport } from './hooks';
import { ReviewStep } from './review/ReviewStep';
import { type ImportFormValues } from './types';
import { useCanImportToGMA } from './useCanImportToGMA';
import { useImportJob } from './useImportJob';
import { useNotificationsDryRun } from './useNotificationsDryRun';
import { useNotificationsStepNavigation } from './useNotificationsStepNavigation';
import { useRulesStepNavigation } from './useRulesStepNavigation';

function Wizard({ notificationsLock, rulesOnly }: { notificationsLock?: NotificationsLock; rulesOnly?: boolean }) {
  const [searchParams] = useURLSearchParams();
  // Settings > Import > Alert rules links here with ?step=rules, so rule-only imports start on the rules step.
  const initialStep = searchParams.get('step') === StepKey.Rules ? StepKey.Rules : undefined;

  return (
    <StepperStateProvider initialStep={initialStep} rulesOnly={rulesOnly}>
      <ImportWizardContent notificationsLock={notificationsLock} />
    </StepperStateProvider>
  );
}

export function ImportWizardGate({ rulesOnly: forceRulesOnly = false }: { rulesOnly?: boolean }) {
  const importAlertmanagerAPIEnabled = useFlagAlertingImportAlertmanagerAPI();
  // Without notifications permission there is no notifications step, so nothing to lock and nothing to read.
  const { canImportNotifications } = useCanImportToGMA();
  const rulesOnly = forceRulesOnly || !canImportNotifications;
  const { isActive, isLoading } = useIsAutoSyncActive();
  const { stagedConfig, isLoading: isStagedConfigLoading } = useStagedConfig({
    skip: !importAlertmanagerAPIEnabled || rulesOnly,
  });

  if (rulesOnly) {
    return <Wizard rulesOnly />;
  }
  if (!importAlertmanagerAPIEnabled) {
    return <Wizard notificationsLock="import-api-disabled" />;
  }
  if (isLoading || isStagedConfigLoading) {
    return <LoadingPlaceholder text={t('alerting.import-to-gma.loading', 'Loading…')} />;
  }
  // Follows the sync and the staged copy live, so acting on the staged card in step 1 (stopping or
  // restarting the sync, promoting or reverting the copy) unlocks or locks that step right away. The wizard
  // holds on to the lock while its own import runs (see useImportJob), since that import is what stages a
  // copy or turns sync on.
  let notificationsLock: NotificationsLock | undefined;
  if (isActive) {
    notificationsLock = 'auto-sync';
  } else if (stagedConfig) {
    notificationsLock = 'staged';
  }
  return <Wizard notificationsLock={notificationsLock} />;
}

/**
 * Rule import for users who can't open Settings > Import, in the regular alert rules shell. Always rules only,
 * because a notifications import ends in Settings, where these users can't go.
 */
export const ImportRulesPage = withPageErrorBoundary(function ImportRulesPage() {
  return (
    <AlertingPageWrapper
      navId={getAlertRulesNavId()}
      pageNav={{ text: t('alerting.import-to-gma.pageTitle', 'Import alert rules') }}
    >
      <ImportWizardGate rulesOnly />
    </AlertingPageWrapper>
  );
});

/**
 * Inner content component that uses the stepper state
 */
function ImportWizardContent({ notificationsLock: liveNotificationsLock }: { notificationsLock?: NotificationsLock }) {
  const { activeStep, setStepCompleted } = useStepperState();

  useEffect(() => {
    trackImportToGMAWizardStarted();
  }, []);

  const formAPI = useForm<ImportFormValues>({
    defaultValues: {
      // Step 1
      step1Completed: false,
      step1Skipped: false,
      policyTreeName: '',
      notificationsSource: 'yaml',
      notificationsDatasourceUID: undefined,
      notificationsDatasourceName: null,
      notificationsYamlFile: null,
      notificationsTemplateFiles: [],
      autoSyncNotificationsEnabled: false,
      // Step 2
      step2Completed: false,
      step2Skipped: false,
      selectedRoutingTree: '',
      rulesSource: 'datasource',
      rulesDatasourceUID: undefined,
      rulesDatasourceName: null,
      rulesYamlFile: null,
      namespace: undefined,
      ruleGroup: undefined,
      targetFolder: undefined,
      pauseAlertingRules: true,
      pauseRecordingRules: true,
      targetDatasourceUID: undefined,
      yamlImportTargetDatasourceUID: undefined,
      yamlImportTargetDatasourceName: undefined,
    },
  });

  const { watch, getValues } = formAPI;
  const step1Completed = watch('step1Completed');

  // Permission checks aligned with backend authorization.go
  const { canImportNotifications, canImportRules } = useCanImportToGMA();

  const dryRun = useNotificationsDryRun(formAPI);
  const step1 = useNotificationsStepNavigation(formAPI, dryRun);

  const step2 = useRulesStepNavigation(formAPI);

  // Step 1 values come from the snapshot validated on Next; the rest is read live.
  const { step1Snapshot } = step1;
  const getImportValues = useCallback(() => ({ ...getValues(), ...step1Snapshot }), [getValues, step1Snapshot]);

  const formValues = getImportValues();
  const plan = getImportPlan(formValues);

  // What the review shows and the import sends, so the two can't disagree. Nothing is read until the rules
  // step is completed. The rules step shows the overwrite warning, so no target folder is passed here.
  const {
    rulesToBeImported: rulesToImport,
    isLoadingRules,
    rulesError,
  } = useRulesToImport({
    rulesSource: formValues.rulesSource,
    rulesDatasourceName: plan.willImportRules ? formValues.rulesDatasourceName : undefined,
    rulesYamlFile: plan.willImportRules ? formValues.rulesYamlFile : null,
    namespace: formValues.namespace,
    ruleGroup: formValues.ruleGroup,
    targetFolder: undefined,
  });

  const { notificationsLock, showConfirmModal, importStatus, importError, startImport, confirmImport, closeConfirm } =
    useImportJob({ getImportValues, rulesToImport, liveNotificationsLock });

  // A locked notifications step has nothing to fill in, so the sidebar shouldn't hold back the steps after
  // it. This only touches the sidebar's own state; the form never marks the step completed, so nothing
  // from it is imported. Once the lock goes away the step has to be filled in or skipped again.
  useEffect(() => {
    setStepCompleted(StepKey.Notifications, Boolean(notificationsLock));
  }, [notificationsLock, setStepCompleted]);

  return (
    <>
      <FormProvider {...formAPI}>
        <WizardLayout>
          {/* Step 1: Notification Configuration */}
          {activeStep === StepKey.Notifications && (
            <Step1Wrapper
              canImport={canImportNotifications}
              notificationsLock={notificationsLock}
              onNext={notificationsLock ? step1.onContinueWhileLocked : step1.onNext}
              onSkip={step1.onSkip}
              dryRunState={dryRun.dryRunState}
              dryRunResult={dryRun.dryRunResult}
              isChecking={dryRun.isChecking}
            />
          )}

          {/* Step 2: Alert Rules */}
          {activeStep === StepKey.Rules && (
            <Step2Wrapper
              step1Completed={step1Completed}
              canImport={canImportRules}
              onNext={step2.onNext}
              onSkip={step2.onSkip}
            />
          )}

          {/* Step 3: Review */}
          {activeStep === StepKey.Review && (
            <ReviewStep
              formData={formValues}
              onStartImport={startImport}
              dryRunResult={dryRun.dryRunResult}
              rulesToImport={rulesToImport}
              isLoadingRules={isLoadingRules}
              rulesError={rulesError}
            />
          )}
        </WizardLayout>
      </FormProvider>

      {/* Confirm Import Modal */}
      <ConfirmImportModal
        isOpen={showConfirmModal}
        importStatus={importStatus}
        errorMessage={importError}
        autoSyncActive={plan.willEnableAutoSync}
        willImportRules={plan.willImportRules}
        onConfirm={confirmImport}
        onDismiss={closeConfirm}
      />
    </>
  );
}
