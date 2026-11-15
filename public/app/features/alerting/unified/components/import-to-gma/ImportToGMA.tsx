import { skipToken } from '@reduxjs/toolkit/query/react';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { shallowEqual } from 'react-redux';
import { useDebounce } from 'react-use';

import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { useFlagAlertingImportAlertmanagerAPI } from '@grafana/runtime/internal';
import { LoadingPlaceholder } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { type RulerCloudRulesConfigDTO } from 'app/types/unified-alerting-dto';

import {
  trackImportToGMADryrunError,
  trackImportToGMADryrunSuccess,
  trackImportToGMADryrunWarning,
  trackImportToGMAError,
  trackImportToGMASuccess,
  trackImportToGMAWizardStarted,
  trackImportToGMAWizardStepSkipped,
} from '../../Analytics';
import { type ValidateAlertmanagerConfigImportArgs, convertApi } from '../../api/convertToGMAApi';
import { useIsAutoSyncActive } from '../../hooks/useIsAutoSyncActive';
import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { useStagedConfig } from '../../settings/import/useStagedConfig';
import { ALERTING_IMPORT_SETTINGS_URL } from '../../settings/navigation';
import { stringifyErrorLike } from '../../utils/misc';
import { createListFilterLink } from '../../utils/navigation';
import { useGetRulerRules } from '../rule-editor/useAlertRuleSuggestions';
import { useAutoSyncConfiguration } from '../settings/useAutoSyncConfiguration';

import { ConfirmImportModal } from './ConfirmImportModal';
import { type NotificationsLock } from './LockNotices';
import { Step1Wrapper } from './Step1Wrapper';
import { Step2Wrapper } from './Step2Wrapper';
import { StepperStateProvider, useStepperState } from './Wizard/StepperState';
import { WizardLayout } from './Wizard/WizardLayout';
import { isAutoSyncCommitted, isAutoSyncSelected } from './Wizard/steps';
import { StepKey } from './Wizard/types';
import { ReviewStep } from './review/ReviewStep';
import { usePredictedAutoSyncIdentifier } from './steps/Step1AlertmanagerResources';
import { findDuplicateTemplateFileName, hasValidSourceSelection, validatePolicyTreeName } from './steps/utils';
import { type ImportFormValues, type Step1Values } from './types';
import { useCanImportToGMA } from './useCanImportToGMA';
import {
  buildRoutingParams,
  deriveDryRunResult,
  deriveDryRunState,
  filterRulerRulesConfig,
  parseDryRunResponse,
  useImportNotifications,
  useImportRules,
} from './useImport';

function pickStep1Values(values: ImportFormValues): Step1Values {
  return {
    policyTreeName: values.policyTreeName,
    notificationsSource: values.notificationsSource,
    notificationsDatasourceUID: values.notificationsDatasourceUID,
    notificationsDatasourceName: values.notificationsDatasourceName,
    notificationsYamlFile: values.notificationsYamlFile,
    notificationsTemplateFiles: values.notificationsTemplateFiles,
    autoSyncNotificationsEnabled: values.autoSyncNotificationsEnabled,
  };
}

/**
 * The dry run checks the configuration, so it can run as soon as there is one: a file was uploaded or a
 * datasource picked. A valid policy tree name is sent along when there is one, since contact points that
 * clash with existing ones are renamed after it. Auto-sync names the tree itself, so its dry run uses the
 * name the sync will pick, and waits until that is known.
 */
export function buildDryRunArgs(
  values: Step1Values,
  autoSyncIdentifier: string | undefined
): ValidateAlertmanagerConfigImportArgs | typeof skipToken {
  const autoSyncActive = isAutoSyncSelected(values.autoSyncNotificationsEnabled ?? false, values.notificationsSource);
  const hasSource =
    !findDuplicateTemplateFileName(values.notificationsTemplateFiles) &&
    hasValidSourceSelection(
      values.notificationsSource,
      values.notificationsYamlFile,
      values.notificationsDatasourceUID
    );
  if (!hasSource || (autoSyncActive && !autoSyncIdentifier)) {
    return skipToken;
  }
  let configIdentifier: string | undefined;
  if (autoSyncActive) {
    configIdentifier = autoSyncIdentifier;
  } else if (values.policyTreeName && validatePolicyTreeName(values.policyTreeName) === true) {
    configIdentifier = values.policyTreeName;
  }
  return {
    source: values.notificationsSource,
    yamlFile: values.notificationsYamlFile,
    templateFiles: values.notificationsTemplateFiles,
    datasourceName: values.notificationsDatasourceName ?? undefined,
    configIdentifier,
  };
}
function Wizard({ notificationsLock }: { notificationsLock?: NotificationsLock }) {
  const [searchParams] = useURLSearchParams();
  // Settings > Import > Alert rules links here with ?step=rules, so rule-only imports start on the rules step.
  const initialStep = searchParams.get('step') === StepKey.Rules ? StepKey.Rules : undefined;

  return (
    <StepperStateProvider initialStep={initialStep}>
      <ImportWizardContent notificationsLock={notificationsLock} />
    </StepperStateProvider>
  );
}

export function ImportWizardGate() {
  const importAlertmanagerAPIEnabled = useFlagAlertingImportAlertmanagerAPI();
  const { isActive, isLoading } = useIsAutoSyncActive();
  const { stagedConfig, isLoading: isStagedConfigLoading } = useStagedConfig({ skip: !importAlertmanagerAPIEnabled });

  if (!importAlertmanagerAPIEnabled) {
    return <Wizard notificationsLock="import-api-disabled" />;
  }
  if (isLoading || isStagedConfigLoading) {
    return <LoadingPlaceholder text={t('alerting.import-to-gma.loading', 'Loading…')} />;
  }
  // Follows the sync and the staged copy live, so acting on the staged card in step 1 (stopping or
  // restarting the sync, promoting or reverting the copy) unlocks or locks that step right away. The wizard
  // holds on to the lock while its own import runs (see ImportWizardContent), since that import is what
  // stages a copy or turns sync on.
  let notificationsLock: NotificationsLock | undefined;
  if (isActive) {
    notificationsLock = 'auto-sync';
  } else if (stagedConfig) {
    notificationsLock = 'staged';
  }
  return <Wizard notificationsLock={notificationsLock} />;
}

/**
 * Inner content component that uses the stepper state
 */
function ImportWizardContent({ notificationsLock: liveNotificationsLock }: { notificationsLock?: NotificationsLock }) {
  const { activeStep, setStepErrors, setStepCompleted } = useStepperState();

  useEffect(() => {
    trackImportToGMAWizardStarted();
  }, []);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [step1Snapshot, setStep1Snapshot] = useState<Step1Values>();
  const [isStep1Checking, setIsStep1Checking] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error' | 'partial-error'>(
    'idle'
  );
  // What the failed request reported, shown in the confirm modal.
  const [importError, setImportError] = useState<string>();

  // An import can turn sync on, which locks the notifications step. Keep the lock the import started with
  // until it is done, so the step isn't swapped out from under it.
  const [notificationsLock, setNotificationsLock] = useState(liveNotificationsLock);
  useEffect(() => {
    if (importStatus === 'idle') {
      setNotificationsLock(liveNotificationsLock);
    }
  }, [importStatus, liveNotificationsLock]);

  // A locked notifications step has nothing to fill in, so the sidebar shouldn't hold back the steps after
  // it. This only touches the sidebar's own state; the form never marks the step completed, so nothing
  // from it is imported. Once the lock goes away the step has to be filled in or skipped again.
  useEffect(() => {
    setStepCompleted(StepKey.Notifications, Boolean(notificationsLock));
  }, [notificationsLock, setStepCompleted]);

  const importNotifications = useImportNotifications();
  const importRules = useImportRules();
  const { save: saveAutoSync } = useAutoSyncConfiguration();
  const notifyApp = useAppNotification();

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
    },
  });

  const { watch, setValue, getValues, trigger } = formAPI;
  const step1Completed = watch('step1Completed');

  // Permission checks aligned with backend authorization.go
  const { canImportNotifications, canImportRules } = useCanImportToGMA();

  // Dry-run validation wiring
  const [
    notificationsSource,
    policyTreeName,
    notificationsDatasourceUID,
    notificationsDatasourceName,
    notificationsYamlFile,
    notificationsTemplateFiles,
    autoSyncNotificationsEnabled,
  ] = watch([
    'notificationsSource',
    'policyTreeName',
    'notificationsDatasourceUID',
    'notificationsDatasourceName',
    'notificationsYamlFile',
    'notificationsTemplateFiles',
    'autoSyncNotificationsEnabled',
  ]);

  const liveStep1Values: Step1Values = useMemo(
    () => ({
      notificationsSource,
      policyTreeName,
      notificationsDatasourceUID,
      notificationsDatasourceName,
      notificationsYamlFile,
      notificationsTemplateFiles,
      autoSyncNotificationsEnabled,
    }),
    [
      notificationsSource,
      policyTreeName,
      notificationsDatasourceUID,
      notificationsDatasourceName,
      notificationsYamlFile,
      notificationsTemplateFiles,
      autoSyncNotificationsEnabled,
    ]
  );
  // Auto-sync names the policy tree itself, so its dry run checks under the name the sync will pick.
  const autoSyncIdentifier = usePredictedAutoSyncIdentifier(
    isAutoSyncSelected(autoSyncNotificationsEnabled ?? false, notificationsSource),
    notificationsDatasourceUID,
    notificationsDatasourceName
  );
  // The step 1 values without the policy tree name. The dry run is rebuilt from these, so typing a name
  // doesn't rerun it; the name it sends along is read when the configuration changes.
  const liveConfigValues = useMemo(
    () => ({
      notificationsSource,
      notificationsDatasourceUID,
      notificationsDatasourceName,
      notificationsYamlFile,
      notificationsTemplateFiles,
      autoSyncNotificationsEnabled,
    }),
    [
      notificationsSource,
      notificationsDatasourceUID,
      notificationsDatasourceName,
      notificationsYamlFile,
      notificationsTemplateFiles,
      autoSyncNotificationsEnabled,
    ]
  );
  const liveDryRunArgs = useMemo(
    () => buildDryRunArgs({ ...liveConfigValues, policyTreeName: getValues('policyTreeName') }, autoSyncIdentifier),
    [liveConfigValues, autoSyncIdentifier, getValues]
  );

  // Debounces args into the query hook to avoid a call per keystroke. Early feedback only — it
  // never gates Next (handleStep1Next runs its own fresh check), so lagging live inputs is fine.
  const [dryRunArgs, setDryRunArgs] = useState<ValidateAlertmanagerConfigImportArgs | typeof skipToken>(skipToken);
  useDebounce(() => setDryRunArgs(liveDryRunArgs), 500, [liveDryRunArgs]);

  const {
    currentData: dryRunRawData,
    isFetching: isDryRunFetching,
    error: dryRunRawError,
  } = convertApi.useValidateAlertmanagerConfigImportQuery(dryRunArgs);

  const dryRunParsedResult = useMemo(
    () => (dryRunRawData ? parseDryRunResponse(dryRunRawData) : undefined),
    [dryRunRawData]
  );
  const dryRunErrorMessage = dryRunRawError ? stringifyErrorLike(dryRunRawError) : undefined;
  const dryRunResult = useMemo(
    () => deriveDryRunResult(dryRunParsedResult, dryRunErrorMessage),
    [dryRunParsedResult, dryRunErrorMessage]
  );
  const dryRunState = useMemo(
    () => deriveDryRunState(isDryRunFetching, dryRunResult, dryRunErrorMessage),
    [isDryRunFetching, dryRunResult, dryRunErrorMessage]
  );

  const [triggerDryRunCheck] = convertApi.useLazyValidateAlertmanagerConfigImportQuery();

  // Sync step errors with dry-run state
  useEffect(() => {
    if (dryRunState === 'error') {
      setStepErrors(StepKey.Notifications, true);
    } else if (dryRunState === 'success' || dryRunState === 'warning') {
      setStepErrors(StepKey.Notifications, false);
    }
  }, [dryRunState, setStepErrors]);

  const autoFilledTreeRef = useRef('');

  // Step 1 handlers
  // Note: WizardStep and NextButton handle stepper state (completed, skipped, visited, navigation)
  // These handlers only need to update form values and control whether to proceed.
  // Runs its own fresh, awaited check rather than trusting the debounced preview above, which can
  // lag the live inputs by design. The values it checks are snapshotted and are what the review and
  // import steps use, so what we validate is what we import.
  const handleStep1Next = useCallback(async (): Promise<boolean> => {
    // The name is checked on its own when the field loses focus. Clicking Next straight from the field
    // can get here before that check finishes, so run it again and wait for it.
    if (!(await trigger('policyTreeName'))) {
      return false;
    }
    const snapshot = pickStep1Values(getValues());
    const args = buildDryRunArgs(snapshot, autoSyncIdentifier);
    if (args !== skipToken) {
      // Keep the preview in sync with what we're about to check, instead of waiting on the debounce.
      setDryRunArgs(args);
      setIsStep1Checking(true);
      try {
        const result = parseDryRunResponse(await triggerDryRunCheck(args).unwrap());
        const state = deriveDryRunState(false, result, undefined);
        if (state === 'warning') {
          trackImportToGMADryrunWarning({
            renamedReceiversCount: result.renamedReceivers.length,
            renamedTimeIntervalsCount: result.renamedTimeIntervals.length,
          });
        } else if (state === 'success') {
          trackImportToGMADryrunSuccess();
        } else {
          trackImportToGMADryrunError();
          return false;
        }
      } catch {
        trackImportToGMADryrunError();
        return false;
      } finally {
        setIsStep1Checking(false);
      }
    }
    setStep1Snapshot(snapshot);
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
  }, [trigger, triggerDryRunCheck, setValue, getValues, autoSyncIdentifier]);

  // An edit after Next makes the snapshot stale. Un-complete the step so the stepper can't jump
  // ahead to Review on values that were never validated.
  useEffect(() => {
    if (!step1Snapshot) {
      return;
    }
    const edited = !shallowEqual(step1Snapshot, liveStep1Values);
    if (edited) {
      setStep1Snapshot(undefined);
      setValue('step1Completed', false);
      setStepCompleted(StepKey.Notifications, false);
    }
  }, [step1Snapshot, liveStep1Values, setValue, setStepCompleted]);

  // A locked step has nothing to import, so moving on is neither completing nor skipping it: both flags
  // stay off, which keeps notifications out of the import and the review and rules steps from calling
  // the step skipped.
  const handleStep1ContinueWhileLocked = useCallback((): boolean => {
    setValue('step1Completed', false);
    setValue('step1Skipped', false);
    setValue('selectedRoutingTree', '');
    autoFilledTreeRef.current = '';
    return true;
  }, [setValue]);

  const handleStep1Skip = useCallback(() => {
    setValue('step1Completed', false);
    setValue('step1Skipped', true);
    setValue('selectedRoutingTree', '');
    autoFilledTreeRef.current = '';
    setStep1Snapshot(undefined);
    trackImportToGMAWizardStepSkipped({ step: 'notifications' });
  }, [setValue]);

  // Step 2 handlers
  const handleStep2Next = useCallback((): boolean => {
    setValue('step2Completed', true);
    setValue('step2Skipped', false);
    return true;
  }, [setValue]);

  const handleStep2Skip = useCallback(() => {
    setValue('step2Completed', false);
    setValue('step2Skipped', true);
    trackImportToGMAWizardStepSkipped({ step: 'rules' });
  }, [setValue]);

  // Step 1 values come from the snapshot validated on Next; the rest is read live.
  const getImportValues = useCallback(() => ({ ...getValues(), ...step1Snapshot }), [getValues, step1Snapshot]);

  // Get ruler rules for rules import (needed when importing from datasource)
  const formValues = getImportValues();
  const willEnableAutoSync = isAutoSyncCommitted(
    formValues.autoSyncNotificationsEnabled ?? false,
    formValues.notificationsSource,
    formValues.step1Skipped
  );
  const willImportRules = formValues.step2Completed && !formValues.step2Skipped;
  const shouldFetchRules = willImportRules && formValues.rulesSource === 'datasource';
  const { rulerRules: rulesFromDatasource } = useGetRulerRules(
    shouldFetchRules ? (formValues.rulesDatasourceName ?? undefined) : undefined
  );

  const handleStartImport = useCallback(() => {
    setShowConfirmModal(true);
  }, []);

  const handleConfirmImport = useCallback(async () => {
    setImportStatus('importing');
    setImportError(undefined);

    const values = getImportValues();
    const willEnableAutoSync = isAutoSyncCommitted(
      values.autoSyncNotificationsEnabled ?? false,
      values.notificationsSource,
      values.step1Skipped
    );
    const willImportNotifications = values.step1Completed && !values.step1Skipped;
    const willImportRules = values.step2Completed && !values.step2Skipped;
    const trackedNotificationsSource =
      willEnableAutoSync || willImportNotifications ? values.notificationsSource : undefined;
    const trackedRulesSource = willImportRules ? values.rulesSource : undefined;

    try {
      // Mutually exclusive: Auto-sync only applies to the datasource source, so at most one of
      // these branches runs.
      if (willEnableAutoSync) {
        const enabled = await saveAutoSync(values.notificationsDatasourceUID, { silent: true });
        if (!enabled) {
          setImportStatus('error');
          trackImportToGMAError({ notificationsSource: trackedNotificationsSource });
          return;
        }
      } else if (willImportNotifications) {
        await importNotifications({
          source: values.notificationsSource,
          datasourceName: values.notificationsDatasourceName ?? undefined,
          yamlFile: values.notificationsYamlFile,
          templateFiles: values.notificationsTemplateFiles,
          configIdentifier: values.policyTreeName,
          promote: false,
        });
      }

      // Rules import is independent of Auto-sync — Auto-sync only mirrors Alertmanager config,
      // never rules.
      if (willImportRules && values.rulesDatasourceUID) {
        // Get the filtered rules payload
        let rulesPayload: RulerCloudRulesConfigDTO = {};

        if (values.rulesSource === 'datasource' && rulesFromDatasource) {
          const { filteredConfig } = filterRulerRulesConfig(rulesFromDatasource, values.namespace, values.ruleGroup);
          rulesPayload = filteredConfig;
        }

        const baseParams = {
          dataSourceUID: values.rulesDatasourceUID,
          targetFolderUID: values.targetFolder?.uid,
          pauseAlertingRules: values.pauseAlertingRules,
          pauseRecordingRules: values.pauseRecordingRules,
          payload: rulesPayload,
          targetDatasourceUID: values.targetDatasourceUID,
        };

        const { notificationSettings } = buildRoutingParams(values.selectedRoutingTree);
        await importRules({ ...baseParams, notificationSettings });
      }

      setImportStatus('success');

      const targetFolder = values.targetFolder;
      const isRootFolder = isEmpty(targetFolder?.uid);

      trackImportToGMASuccess({
        notificationsSource: trackedNotificationsSource,
        rulesSource: trackedRulesSource,
        isRootFolder,
        namespace: values.namespace,
        ruleGroup: values.ruleGroup,
        pauseRecordingRules: values.pauseRecordingRules,
        pauseAlertingRules: values.pauseAlertingRules,
      });

      // Redirect to alert list with folder filter after a short delay
      const ruleListUrl = createListFilterLink(isRootFolder ? [] : [['namespace', targetFolder?.title ?? '']], {
        skipSubPath: true,
      });

      // Holds the "Import Successful" state on screen for a beat — Modal has no close animation,
      // so without this delay the confirmation would disappear instantly instead of being seen.
      setTimeout(() => {
        setShowConfirmModal(false);
        if (willEnableAutoSync) {
          const autoSyncSuccessBody = t(
            'alerting.wizard-import-to-gma.autosync-success-body',
            'Grafana will keep syncing alert configuration from this data source.'
          );
          notifyApp.success(
            t('alerting.wizard-import-to-gma.autosync-success-title', 'Auto-sync enabled'),
            willImportRules
              ? `${autoSyncSuccessBody} ${t('alerting.wizard-import-to-gma.autosync-rules-imported-note', 'Your alert rules were also imported.')}`
              : autoSyncSuccessBody
          );
          locationService.push(ALERTING_IMPORT_SETTINGS_URL);
        } else if (willImportNotifications) {
          // A staged notifications import lands on the Import tab so the user can review the staged
          // copy and decide to promote or revert it. Everything else keeps the rule-list redirect.
          notifyApp.success(
            t('alerting.wizard-import-to-gma.staged-success-title', 'Configuration staged'),
            t(
              'alerting.wizard-import-to-gma.staged-success-body',
              'Your imported config is now staged in the Import tab.'
            )
          );
          locationService.push(ALERTING_IMPORT_SETTINGS_URL);
        } else {
          notifyApp.success(
            t('alerting.wizard-import-to-gma.success', 'Successfully imported resources to Grafana Alerting.')
          );
          locationService.push(ruleListUrl);
        }
      }, 1500);
    } catch (err) {
      // saveAutoSync swallows its own errors and resolves to false rather than throwing, so
      // reaching here with willEnableAutoSync means auto-sync had already been persisted and the
      // rules import that followed is what failed — the copy must not claim auto-sync failed.
      setImportStatus(willEnableAutoSync ? 'partial-error' : 'error');
      trackImportToGMAError({ notificationsSource: trackedNotificationsSource, rulesSource: trackedRulesSource });
      setImportError(stringifyErrorLike(err));
    }
  }, [getImportValues, importNotifications, importRules, rulesFromDatasource, saveAutoSync, notifyApp]);

  const handleCancelConfirm = useCallback(() => {
    // Only allow closing if not importing
    if (importStatus !== 'importing') {
      setShowConfirmModal(false);
      setImportStatus('idle');
    }
  }, [importStatus]);

  return (
    <>
      <FormProvider {...formAPI}>
        <WizardLayout>
          {/* Step 1: Notification Configuration */}
          {activeStep === StepKey.Notifications && (
            <Step1Wrapper
              canImport={canImportNotifications}
              notificationsLock={notificationsLock}
              onNext={notificationsLock ? handleStep1ContinueWhileLocked : handleStep1Next}
              onSkip={handleStep1Skip}
              dryRunState={dryRunState}
              dryRunResult={dryRunResult}
              isChecking={isStep1Checking}
            />
          )}

          {/* Step 2: Alert Rules */}
          {activeStep === StepKey.Rules && (
            <Step2Wrapper
              step1Completed={step1Completed}
              canImport={canImportRules}
              onNext={handleStep2Next}
              onSkip={handleStep2Skip}
            />
          )}

          {/* Step 3: Review */}
          {activeStep === StepKey.Review && (
            <ReviewStep
              formData={formValues}
              onStartImport={handleStartImport}
              dryRunResult={dryRunResult}
              rulesFromDatasource={rulesFromDatasource}
            />
          )}
        </WizardLayout>
      </FormProvider>

      {/* Confirm Import Modal */}
      <ConfirmImportModal
        isOpen={showConfirmModal}
        importStatus={importStatus}
        errorMessage={importError}
        autoSyncActive={willEnableAutoSync}
        willImportRules={willImportRules}
        onConfirm={handleConfirmImport}
        onDismiss={handleCancelConfirm}
      />
    </>
  );
}
