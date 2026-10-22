import { css } from '@emotion/css';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { shallowEqual } from 'react-redux';
import { useDebounce } from 'react-use';

import { getRoutingTreeDisplayName } from '@grafana/alerting/unstable';
import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { useFlagAlertingImportAlertmanagerAPI } from '@grafana/runtime/internal';
import {
  Alert,
  Badge,
  Box,
  Button,
  Icon,
  LoadingPlaceholder,
  Modal,
  Spinner,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { type RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import {
  trackImportToGMADryrunError,
  trackImportToGMADryrunSuccess,
  trackImportToGMADryrunWarning,
  trackImportToGMAError,
  trackImportToGMASuccess,
  trackImportToGMAWizardStarted,
  trackImportToGMAWizardStepSkipped,
} from '../../Analytics';
import { type ValidateAlertmanagerConfigImportArgs, convertToGMAApi } from '../../api/convertToGMAApi';
import { useIsAutoSyncActive } from '../../hooks/useIsAutoSyncActive';
import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { StagedImportSection } from '../../settings/import/StagedImportSection';
import { useStagedConfig } from '../../settings/import/useStagedConfig';
import { ALERTING_IMPORT_SETTINGS_URL } from '../../settings/navigation';
import { type Folder } from '../../types/rule-form';
import { stringifyErrorLike } from '../../utils/misc';
import { createListFilterLink } from '../../utils/navigation';
import { useGetRulerRules } from '../rule-editor/useAlertRuleSuggestions';
import { useAutoSyncConfiguration } from '../settings/useAutoSyncConfiguration';

import { RenamedResourcesList } from './CollapsibleRenameList';
import { PolicyTreeNameHelp } from './PolicyTreeNameHelp';
import { StepperStateProvider, useStepperState } from './Wizard/StepperState';
import { WizardLayout } from './Wizard/WizardLayout';
import { WizardStep } from './Wizard/WizardStep';
import { getPauseRulesLabel, isAutoSyncCommitted, isAutoSyncSelected } from './Wizard/steps';
import { StepKey } from './Wizard/types';
import { PreviewContentModal } from './preview/PreviewContentModal';
import { useNotificationsPreview } from './preview/useNotificationsPreview';
import { formatPreviewError, usePreviewContent } from './preview/usePreviewContent';
import { Step1Content, usePredictedAutoSyncIdentifier, useStep1Validation } from './steps/Step1AlertmanagerResources';
import { Step2Content, useStep2Validation } from './steps/Step2AlertRules';
import { findDuplicateTemplateFileName, hasValidSourceSelection, validatePolicyTreeName } from './steps/utils';
import { type DryRunState, type DryRunValidationResult } from './types';
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

export interface ImportFormValues {
  // Step 1: Alertmanager resources
  step1Completed: boolean;
  step1Skipped: boolean;
  /**
   * Name of the imported policy tree (the config identifier for the imported Alertmanager config).
   * For now, this is free-form as we don't have an API to retrieve the list of available policy trees.
   */
  policyTreeName: string;
  notificationsSource: 'datasource' | 'yaml';
  notificationsDatasourceUID?: string;
  notificationsDatasourceName: string | null;
  notificationsYamlFile: File | null;
  notificationsTemplateFiles: File[];
  /** Checked in Step 1 when the source is a data source; enables continuous sync instead of staging. */
  autoSyncNotificationsEnabled?: boolean;

  // Step 2: Alert rules
  step2Completed: boolean;
  step2Skipped: boolean;
  selectedRoutingTree: string; // Routing tree name from the API or from Step 1
  rulesSource: 'datasource' | 'yaml';
  rulesDatasourceUID?: string;
  rulesDatasourceName: string | null;
  rulesYamlFile: File | null;
  // Filters
  namespace?: string;
  ruleGroup?: string;
  // Settings
  targetFolder?: Folder;
  pauseAlertingRules: boolean;
  pauseRecordingRules: boolean;
  targetDatasourceUID?: string;
}

type Step1Values = Pick<
  ImportFormValues,
  | 'policyTreeName'
  | 'notificationsSource'
  | 'notificationsDatasourceUID'
  | 'notificationsDatasourceName'
  | 'notificationsYamlFile'
  | 'notificationsTemplateFiles'
  | 'autoSyncNotificationsEnabled'
>;

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
function buildDryRunArgs(
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
/**
 * Why the notifications step can't be used. Rule import doesn't depend on any of these, so the
 * rest of the wizard stays available.
 * - auto-sync: notification configuration is a read-only mirror of the synced data source.
 * - staged: an earlier import is still staged. It has to be promoted or reverted before another one.
 * - import-api-disabled: the Alertmanager import API is turned off, so its endpoints answer 501.
 */
type NotificationsLock = 'auto-sync' | 'staged' | 'import-api-disabled';

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

function ImportAPIDisabledNotice() {
  return (
    <Alert
      severity="info"
      title={t('alerting.import-to-gma.import-api-disabled.title', 'Notification configuration import is unavailable')}
    >
      <Trans i18nKey="alerting.import-to-gma.import-api-disabled.description">
        Importing notification configuration is not enabled on this Grafana instance. Continue to import rules.
      </Trans>
    </Alert>
  );
}

function AutoSyncActiveNotice() {
  return (
    <Stack direction="column" gap={2}>
      <AutoSyncActiveAlert />
      <StagedImportSection />
    </Stack>
  );
}

function StagedConfigNotice() {
  return (
    <Stack direction="column" gap={2}>
      <Alert
        severity="info"
        title={t('alerting.import-to-gma.staged-block.title', 'A configuration is already staged')}
      >
        <Trans i18nKey="alerting.import-to-gma.staged-block.description">
          Promote or revert the staged configuration below before importing another one, or continue to import rules.
        </Trans>
      </Alert>
      <StagedImportSection />
    </Stack>
  );
}

function AutoSyncActiveAlert() {
  return (
    <Alert severity="info" title={t('alerting.import-to-gma.autosync-active-block.title', 'Auto-sync is enabled')}>
      <Trans i18nKey="alerting.import-to-gma.autosync-active-block.description">
        Grafana is continuously syncing alert configuration from a data source, so notification configuration is a
        read-only mirror and cannot be imported into. Disable sync below to import notification configuration, or
        continue to import rules.
      </Trans>
    </Alert>
  );
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
  } = convertToGMAApi.useValidateAlertmanagerConfigImportQuery(dryRunArgs);

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

  const [triggerDryRunCheck] = convertToGMAApi.useLazyValidateAlertmanagerConfigImportQuery();

  // Sync step errors with dry-run state
  useEffect(() => {
    if (dryRunState === 'error') {
      setStepErrors(StepKey.Notifications, true);
    } else if (dryRunState === 'success' || dryRunState === 'warning') {
      setStepErrors(StepKey.Notifications, false);
    }
  }, [dryRunState, setStepErrors]);

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
    if (snapshot.policyTreeName && !getValues('selectedRoutingTree')) {
      setValue('selectedRoutingTree', snapshot.policyTreeName);
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
    return true;
  }, [setValue]);

  const handleStep1Skip = useCallback(() => {
    setValue('step1Completed', false);
    setValue('step1Skipped', true);
    setValue('selectedRoutingTree', '');
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
        let rulesPayload: RulerRulesConfigDTO = {};

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

function Step1Wrapper({
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

/**
 * Step 2 wrapper that uses the validation hook
 */
interface Step2WrapperProps {
  step1Completed: boolean;
  canImport: boolean;
  onNext: () => boolean;
  onSkip: () => void;
}

function Step2Wrapper({ step1Completed, canImport, onNext, onSkip }: Step2WrapperProps) {
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

// Validation Status Indicator Component
interface ValidationStatusIndicatorProps {
  result: DryRunValidationResult;
}

function ValidationStatusIndicator({ result }: ValidationStatusIndicatorProps) {
  const styles = useStyles2(getValidationIndicatorStyles);

  const hasRenames = result.renamedReceivers.length > 0 || result.renamedTimeIntervals.length > 0;
  const isSuccess = result.valid && !hasRenames;
  const isWarning = result.valid && hasRenames;

  if (isSuccess) {
    return (
      <Stack direction="row" gap={1} alignItems="center">
        <Icon name="check-circle" className={styles.successIcon} />
        <Text color="success">
          {t('alerting.import-to-gma.review.validation-ok', 'No conflicts found. Ready to import.')}
        </Text>
      </Stack>
    );
  }

  if (isWarning) {
    return (
      <Stack direction="column" gap={1}>
        <Stack direction="row" gap={1} alignItems="center">
          <Icon name="exclamation-triangle" className={styles.warningIcon} />
          <Text color="warning">
            {t(
              'alerting.import-to-gma.review.validation-warning',
              'Some resources will be renamed to avoid conflicts.'
            )}
          </Text>
        </Stack>
        <RenamedResourcesList
          renamedReceivers={result.renamedReceivers}
          renamedTimeIntervals={result.renamedTimeIntervals}
        />
      </Stack>
    );
  }

  // Error case
  return (
    <Stack direction="row" gap={1} alignItems="center">
      <Icon name="exclamation-circle" className={styles.errorIcon} />
      <Text color="error">
        {result.error || t('alerting.import-to-gma.review.validation-error', 'Validation failed.')}
      </Text>
    </Stack>
  );
}

const getValidationIndicatorStyles = (theme: GrafanaTheme2) => ({
  successIcon: css({ color: theme.colors.success.main }),
  warningIcon: css({ color: theme.colors.warning.main }),
  errorIcon: css({ color: theme.colors.error.main }),
});

interface NotificationsCardContentProps {
  formData: ImportFormValues;
  autoSyncActive: boolean;
  willImportNotifications: boolean;
  dryRunResult?: DryRunValidationResult;
  styles: ReturnType<typeof getStyles>;
}

function NotificationsCardContent({
  formData,
  autoSyncActive,
  willImportNotifications,
  dryRunResult,
  styles,
}: NotificationsCardContentProps) {
  if (!willImportNotifications) {
    return (
      <Text color="secondary">
        <Trans i18nKey="alerting.import-to-gma.review.notifications-skipped">
          Notification configuration will not be imported.
        </Trans>
      </Text>
    );
  }

  if (autoSyncActive) {
    return (
      <div className={styles.row}>
        <Text color="secondary">{t('alerting.import-to-gma.review.source', 'Source')}</Text>
        <Text>{formData.notificationsDatasourceName || 'Data source'}</Text>
      </div>
    );
  }

  return (
    <Stack direction="column" gap={1}>
      <div className={styles.row}>
        <Text color="secondary">{t('alerting.import-to-gma.review.source', 'Source')}</Text>
        <Text>
          {formData.notificationsSource === 'yaml'
            ? formData.notificationsYamlFile?.name || 'YAML file'
            : formData.notificationsDatasourceName || 'Data source'}
        </Text>
      </div>
      {/* Uploaded template files only apply to the YAML source; list them so the user can confirm
          which templates will be imported. */}
      {formData.notificationsSource === 'yaml' && formData.notificationsTemplateFiles.length > 0 && (
        <div className={styles.row}>
          <Text color="secondary">{t('alerting.import-to-gma.review.templates', 'Templates')}</Text>
          <Text>{formData.notificationsTemplateFiles.map((file) => file.name).join(', ')}</Text>
        </div>
      )}
      <div className={styles.row}>
        <Text color="secondary">{t('alerting.import-to-gma.review.policy-tree', 'Policy tree')}</Text>
        <Stack direction="row" gap={1} alignItems="center" wrap="wrap">
          <Text weight="medium">{formData.policyTreeName}</Text>
          <PolicyTreeNameHelp />
        </Stack>
      </div>
      {dryRunResult && (
        <Box marginTop={1}>
          <ValidationStatusIndicator result={dryRunResult} />
        </Box>
      )}
    </Stack>
  );
}

interface RulesCardContentProps {
  formData: ImportFormValues;
  willImportRules: boolean;
  styles: ReturnType<typeof getStyles>;
}

function RulesCardContent({ formData, willImportRules, styles }: RulesCardContentProps) {
  if (!willImportRules) {
    return (
      <Text color="secondary">
        <Trans i18nKey="alerting.import-to-gma.review.rules-skipped">Alert rules will not be imported.</Trans>
      </Text>
    );
  }

  return (
    <Stack direction="column" gap={1}>
      <div className={styles.row}>
        <Text color="secondary">{t('alerting.import-to-gma.review.source', 'Source')}</Text>
        <Text>
          {formData.rulesSource === 'yaml'
            ? formData.rulesYamlFile?.name || 'YAML file'
            : formData.rulesDatasourceName || 'Data source'}
        </Text>
      </div>
      <div className={styles.row}>
        <Text color="secondary">{t('alerting.import-to-gma.review.routing', 'Notification routing')}</Text>
        <Text>
          {formData.selectedRoutingTree
            ? t('alerting.import-to-gma.review.routing-tree', 'Policy tree: {{name}}', {
                name: getRoutingTreeDisplayName(formData.selectedRoutingTree),
              })
            : t('alerting.import-to-gma.review.routing-none', 'No policy tree selected')}
        </Text>
      </div>
      {(formData.namespace || formData.ruleGroup) && (
        <div className={styles.row}>
          <Text color="secondary">{t('alerting.import-to-gma.review.filter', 'Filter')}</Text>
          <Text>
            {formData.namespace &&
              !formData.ruleGroup &&
              `${t('alerting.import-to-gma.review.namespace', 'Namespace')}: ${formData.namespace}`}
            {formData.namespace && formData.ruleGroup && `${formData.namespace} / ${formData.ruleGroup}`}
          </Text>
        </div>
      )}
      {formData.targetFolder && (
        <div className={styles.row}>
          <Text color="secondary">{t('alerting.import-to-gma.review.folder', 'Target folder')}</Text>
          <Text>{formData.targetFolder.title}</Text>
        </div>
      )}
      <div className={styles.row}>
        <Text color="secondary">{t('alerting.import-to-gma.review.pause', 'Pause rules')}</Text>
        <Stack direction="row" gap={0.5} alignItems="center">
          {(formData.pauseAlertingRules || formData.pauseRecordingRules) && <Icon name="pause" size="sm" />}
          <Text>{getPauseRulesLabel(formData.pauseAlertingRules, formData.pauseRecordingRules)}</Text>
        </Stack>
      </div>
    </Stack>
  );
}

// Review Step Component
interface ReviewStepProps {
  formData: ImportFormValues;
  onStartImport: () => void;
  dryRunResult?: DryRunValidationResult;
  rulesFromDatasource?: RulerRulesConfigDTO;
}

// True when a source is 'yaml' and its file has actually been uploaded (not just selected as the source type).
// Typed as a guard so callers get `file` narrowed to `File` afterwards, instead of a bare boolean.
function hasYamlUpload(source: string, file: File | null): file is File {
  return source === 'yaml' && file !== null;
}

function ReviewStep({ formData, onStartImport, dryRunResult, rulesFromDatasource }: ReviewStepProps) {
  const styles = useStyles2(getStyles);
  const { setActiveStep } = useStepperState();

  const willImportNotifications = formData.step1Completed && !formData.step1Skipped;
  const notificationsPreview = useNotificationsPreview(formData, { enabled: willImportNotifications });
  const rulesPreview = usePreviewContent('');

  const willImportRules = formData.step2Completed && !formData.step2Skipped;
  const nothingToImport = !willImportNotifications && !willImportRules;
  const willEnableAutoSync = isAutoSyncCommitted(
    formData.autoSyncNotificationsEnabled ?? false,
    formData.notificationsSource,
    formData.step1Skipped
  );

  const handleBack = () => {
    setActiveStep(StepKey.Rules);
  };

  // Load rules preview content. Rule definitions (expr/labels/annotations) don't carry secrets,
  // unlike notifier configs, so this is shown as-is rather than run through redactPreviewSecrets.
  const handlePreviewRules = useCallback(() => {
    rulesPreview.show(async () => {
      if (hasYamlUpload(formData.rulesSource, formData.rulesYamlFile)) {
        return formData.rulesYamlFile.text();
      } else if (formData.rulesSource === 'datasource' && rulesFromDatasource) {
        // Apply filters if set
        const { filteredConfig } = filterRulerRulesConfig(rulesFromDatasource, formData.namespace, formData.ruleGroup);
        return JSON.stringify(filteredConfig, null, 2);
      }
      return '';
    }, formatPreviewError);
  }, [
    rulesPreview,
    formData.rulesSource,
    formData.rulesYamlFile,
    formData.namespace,
    formData.ruleGroup,
    rulesFromDatasource,
  ]);

  // Calculate rules count
  const rulesCount = useMemo(() => {
    if (!willImportRules || !rulesFromDatasource) {
      return 0;
    }
    const { filteredConfig } = filterRulerRulesConfig(rulesFromDatasource, formData.namespace, formData.ruleGroup);
    let count = 0;
    Object.values(filteredConfig).forEach((groups) => {
      groups.forEach((group) => {
        count += group.rules.length;
      });
    });
    return count;
  }, [willImportRules, rulesFromDatasource, formData.namespace, formData.ruleGroup]);

  return (
    <Stack direction="column" gap={3}>
      <Box>
        <Text variant="h4" element="h2">
          {t('alerting.import-to-gma.review.heading', 'Review Import')}
        </Text>
        <Text color="secondary">
          <Trans i18nKey="alerting.import-to-gma.review.subtitle">
            Review each section and once you are happy, start the import.
          </Trans>
        </Text>
      </Box>

      {nothingToImport ? (
        <Alert severity="info" title={t('alerting.import-to-gma.review.nothing', 'Nothing to import')}>
          <Trans i18nKey="alerting.import-to-gma.review.nothing-desc">
            Neither notification configuration nor alert rules are set to be imported. Go back and configure at least
            one import source.
          </Trans>
        </Alert>
      ) : (
        <Stack direction="column" gap={2}>
          {/* Notifications Summary Card */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Text variant="h5" element="h3">
                {t('alerting.import-to-gma.review.notifications-title', 'Notification Configuration')}
              </Text>
              {willEnableAutoSync && (
                <Badge
                  color="green"
                  icon="sync"
                  text={t('alerting.import-to-gma.review.autosync-badge', 'Will sync continuously')}
                />
              )}
              {!willEnableAutoSync && willImportNotifications && (
                <Stack direction="row" gap={1} alignItems="center">
                  <Text variant="bodySmall" color="secondary">
                    {t('alerting.import-to-gma.review.will-import-config', 'Will import this configuration')}
                  </Text>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="eye"
                    onClick={notificationsPreview.open}
                    disabled={notificationsPreview.schemasLoading}
                    aria-label={t('alerting.import-to-gma.review.preview-config-aria', 'Preview configuration')}
                  >
                    {t('alerting.import-to-gma.review.preview', 'Preview')}
                  </Button>
                </Stack>
              )}
              {formData.step1Skipped && (
                <span className={styles.badgeSkipped}>{t('alerting.import-to-gma.review.skipped', 'Skipped')}</span>
              )}
            </div>
            <div className={styles.cardContent}>
              <NotificationsCardContent
                formData={formData}
                autoSyncActive={willEnableAutoSync}
                willImportNotifications={willImportNotifications}
                dryRunResult={dryRunResult}
                styles={styles}
              />
            </div>
          </div>

          {/* Rules Summary Card */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Text variant="h5" element="h3">
                {t('alerting.import-to-gma.review.rules-title', 'Rules')}
              </Text>
              {willImportRules && (
                <Stack direction="row" gap={1} alignItems="center">
                  <Text variant="bodySmall" color="secondary">
                    {rulesCount > 0
                      ? t('alerting.import-to-gma.review.will-import-rules-count', '', {
                          count: rulesCount,
                          defaultValue_one: 'Will import {{count}} rules',
                          defaultValue_other: 'Will import {{count}} rules',
                        })
                      : t('alerting.import-to-gma.review.will-import-rules', 'Will import rules')}
                  </Text>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="eye"
                    onClick={handlePreviewRules}
                    aria-label={t('alerting.import-to-gma.review.preview-rules-aria', 'Preview alert rules')}
                  >
                    {t('alerting.import-to-gma.review.preview', 'Preview')}
                  </Button>
                </Stack>
              )}
              {formData.step2Skipped && (
                <span className={styles.badgeSkipped}>{t('alerting.import-to-gma.review.skipped', 'Skipped')}</span>
              )}
            </div>
            <div className={styles.cardContent}>
              <RulesCardContent formData={formData} willImportRules={willImportRules} styles={styles} />
            </div>
          </div>
        </Stack>
      )}

      {/* Action buttons */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" gap={1}>
          <Button variant="secondary" icon="arrow-left" onClick={handleBack}>
            {t('alerting.import-to-gma.review.back', 'Rules')}
          </Button>
          <Button
            variant="primary"
            icon={willEnableAutoSync ? 'sync' : 'upload'}
            onClick={onStartImport}
            disabled={nothingToImport}
          >
            {willEnableAutoSync
              ? t('alerting.import-to-gma.review.enable-autosync', 'Enable auto-sync')
              : t('alerting.import-to-gma.review.start', 'Start import')}
          </Button>
        </Stack>
      </Stack>

      {/* Notifications Preview Modal */}
      <PreviewContentModal
        isOpen={notificationsPreview.isOpen}
        title={t('alerting.import-to-gma.preview.notifications-title', 'Notifications Config Preview')}
        content={notificationsPreview.content}
        isLoading={notificationsPreview.isLoading}
        language={formData.notificationsSource === 'yaml' ? 'yaml' : 'json'}
        onDismiss={notificationsPreview.dismiss}
        reveal={{
          isRevealed: notificationsPreview.isRevealed,
          canReveal: notificationsPreview.canReveal,
          onToggle: notificationsPreview.toggleReveal,
        }}
      />

      {/* Rules Preview Modal */}
      <PreviewContentModal
        isOpen={rulesPreview.isOpen}
        title={t('alerting.import-to-gma.preview.rules-title', 'Alert Rules Preview')}
        content={rulesPreview.content}
        isLoading={rulesPreview.isLoading}
        language={formData.rulesSource === 'yaml' ? 'yaml' : 'json'}
        onDismiss={rulesPreview.hide}
      />
    </Stack>
  );
}

// Confirm Import Modal Component
interface ConfirmImportModalProps {
  isOpen: boolean;
  importStatus: 'idle' | 'importing' | 'success' | 'error' | 'partial-error';
  /** What the failed request reported. Missing when turning on Auto-sync failed, which has no message. */
  errorMessage?: string;
  /** Swaps the generic staging copy for Auto-sync-specific copy. */
  autoSyncActive: boolean;
  /** Whether the Rules step will also run in this same submit, alongside Auto-sync. */
  willImportRules: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

function ConfirmImportModal({
  isOpen,
  importStatus,
  errorMessage,
  autoSyncActive,
  willImportRules,
  onConfirm,
  onDismiss,
}: ConfirmImportModalProps) {
  const isImporting = importStatus === 'importing';
  const isSuccess = importStatus === 'success';
  const isError = importStatus === 'error';
  // Rules import failed after Auto-sync had already been persisted — distinct from Auto-sync
  // itself failing, so the copy must not claim Auto-sync failed.
  const isPartialError = importStatus === 'partial-error';

  // Only referenced from inside each body getter's Auto-sync branch below, so rules riding along
  // with Auto-sync just appends this fact rather than needing a fully separate sentence per stage
  // — the non-Auto-sync copy already covers rules implicitly via "resources".
  const rulesPendingNote = willImportRules && (
    <>
      {' '}
      <Trans i18nKey="alerting.import-to-gma.confirm.autosync-rules-note">
        Your selected alert rules will also be imported.
      </Trans>
    </>
  );
  const rulesImportedNote = willImportRules && (
    <>
      {' '}
      <Trans i18nKey="alerting.import-to-gma.confirm.autosync-rules-imported-note">
        Your selected alert rules were also imported.
      </Trans>
    </>
  );

  const getTitle = () => {
    if (isImporting) {
      return autoSyncActive
        ? t('alerting.import-to-gma.confirm.autosync-importing-title', 'Enabling auto-sync...')
        : t('alerting.import-to-gma.confirm.importing-title', 'Importing...');
    }
    if (isSuccess) {
      return autoSyncActive
        ? t('alerting.import-to-gma.confirm.autosync-success-title', 'Auto-sync Enabled')
        : t('alerting.import-to-gma.confirm.success-title', 'Import Successful');
    }
    if (isPartialError) {
      return t('alerting.import-to-gma.confirm.autosync-rules-error-title', 'Rules Import Failed');
    }
    if (isError) {
      return autoSyncActive
        ? t('alerting.import-to-gma.confirm.autosync-error-title', 'Auto-sync Failed')
        : t('alerting.import-to-gma.confirm.error-title', 'Import Failed');
    }
    return autoSyncActive
      ? t('alerting.import-to-gma.confirm.autosync-title', 'Confirm Auto-sync')
      : t('alerting.import-to-gma.confirm.title', 'Confirm Import');
  };

  const getConfirmBody = () => {
    if (autoSyncActive) {
      return (
        <>
          <Trans i18nKey="alerting.import-to-gma.confirm.autosync-body">
            Are you sure you want to enable Auto-sync? Grafana will continuously sync alert configuration from this data
            source until you turn it off in Alerting settings.
          </Trans>
          {rulesPendingNote}
        </>
      );
    }
    return (
      <Trans i18nKey="alerting.import-to-gma.confirm.body">
        Are you sure you want to start the import? This action will create new resources in Grafana Alerting.
      </Trans>
    );
  };

  const getImportingBody = () => {
    if (autoSyncActive) {
      return (
        <>
          <Trans i18nKey="alerting.import-to-gma.confirm.autosync-importing-body">
            Enabling Auto-sync. Please wait...
          </Trans>
          {rulesPendingNote}
        </>
      );
    }
    return (
      <Trans i18nKey="alerting.import-to-gma.confirm.importing-body">
        Importing resources to Grafana Alerting. Please wait...
      </Trans>
    );
  };

  const getSuccessBody = () => {
    if (autoSyncActive) {
      return (
        <>
          <Trans i18nKey="alerting.import-to-gma.confirm.autosync-success-body">
            Auto-sync enabled. Redirecting...
          </Trans>
          {rulesImportedNote}
        </>
      );
    }
    return (
      <Trans i18nKey="alerting.import-to-gma.confirm.success-body">
        Resources imported successfully. Redirecting...
      </Trans>
    );
  };

  const getErrorBody = () => {
    if (isPartialError) {
      return (
        <Trans i18nKey="alerting.import-to-gma.confirm.autosync-rules-error-body">
          Auto-sync was enabled, but importing alert rules failed. Check the error details below and try again.
        </Trans>
      );
    }
    return autoSyncActive ? (
      <Trans i18nKey="alerting.import-to-gma.confirm.autosync-error-body">
        Failed to enable Auto-sync. Please try again.
      </Trans>
    ) : (
      <Trans i18nKey="alerting.import-to-gma.confirm.error-body">
        Failed to import resources. Check the error details below and try again.
      </Trans>
    );
  };

  return (
    <Modal isOpen={isOpen} title={getTitle()} onDismiss={onDismiss}>
      <Stack direction="column" gap={2}>
        {importStatus === 'idle' && <Text>{getConfirmBody()}</Text>}

        {isImporting && (
          <Stack direction="row" gap={2} alignItems="center">
            <Spinner />
            <Text>{getImportingBody()}</Text>
          </Stack>
        )}

        {isSuccess && (
          <Stack direction="row" gap={2} alignItems="center">
            <Icon name="check-circle" size="xl" color="green" />
            <Text>{getSuccessBody()}</Text>
          </Stack>
        )}

        {(isError || isPartialError) && (
          <Stack direction="column" gap={1}>
            <Text color="error">{getErrorBody()}</Text>
            {errorMessage && (
              <Alert severity="error" title={t('alerting.import-to-gma.confirm.error-details', 'Error details')}>
                {errorMessage}
              </Alert>
            )}
          </Stack>
        )}
      </Stack>

      <Modal.ButtonRow>
        {importStatus === 'idle' && (
          <>
            <Button variant="secondary" onClick={onDismiss}>
              {t('alerting.common.cancel', 'Cancel')}
            </Button>
            <Button variant="primary" fill="solid" onClick={onConfirm}>
              {autoSyncActive
                ? t('alerting.import-to-gma.confirm.autosync-confirm', 'Enable auto-sync')
                : t('alerting.import-to-gma.confirm.confirm', 'Start Import')}
            </Button>
          </>
        )}

        {(isError || isPartialError) && (
          <Button variant="secondary" onClick={onDismiss}>
            {t('alerting.common.close', 'Close')}
          </Button>
        )}
      </Modal.ButtonRow>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    overflow: 'hidden',
  }),
  cardHeader: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  cardContent: css({
    padding: theme.spacing(2),
  }),
  row: css({
    display: 'flex',
    gap: theme.spacing(2),
    '& > span:first-of-type': {
      minWidth: '150px',
    },
  }),
  badgeSkipped: css({
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.warning.transparent,
    color: theme.colors.warning.text,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
  }),
});
