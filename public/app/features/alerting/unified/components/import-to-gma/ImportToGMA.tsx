import { css } from '@emotion/css';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { shallowEqual } from 'react-redux';
import { useDebounce } from 'react-use';

import { getRoutingTreeDisplayName } from '@grafana/alerting/unstable';
import { type GrafanaTheme2, OrgRole } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
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
  TextLink,
  useStyles2,
} from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import { type RulerCloudRulesConfigDTO, type RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import {
  trackImportToGMADryrunError,
  trackImportToGMADryrunSuccess,
  trackImportToGMADryrunWarning,
  trackImportToGMAError,
  trackImportToGMASuccess,
  trackImportToGMAWizardCancelled,
  trackImportToGMAWizardStarted,
  trackImportToGMAWizardStepSkipped,
} from '../../Analytics';
import { type ValidateAlertmanagerConfigImportArgs, convertApi } from '../../api/convertToGMAApi';
import { useIsAutoSyncActive } from '../../hooks/useIsAutoSyncActive';
import { getAlertRulesNavId } from '../../navigation/useAlertRulesNav';
import { ALERTING_IMPORT_SETTINGS_URL } from '../../settings/navigation';
import { type Folder } from '../../types/rule-form';
import { DOCS_URL_ALERTING_MIGRATION } from '../../utils/docs';
import { stringifyErrorLike } from '../../utils/misc';
import { ALERTING_PATHS, createListFilterLink } from '../../utils/navigation';
import { createRelativeUrl } from '../../utils/url';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertingPageWrapper } from '../AlertingPageWrapper';
import { useGetRulerRules } from '../rule-editor/useAlertRuleSuggestions';
import { useAutoSyncConfiguration } from '../settings/useAutoSyncConfiguration';

import { RenamedResourcesList } from './CollapsibleRenameList';
import { PolicyTreeNameHelp } from './PolicyTreeNameHelp';
import { CancelButton } from './Wizard/CancelButton';
import { StepperStateProvider, useStepperState } from './Wizard/StepperState';
import { WizardLayout } from './Wizard/WizardLayout';
import { WizardStep } from './Wizard/WizardStep';
import { getPauseRulesLabel, isAutoSyncCommitted } from './Wizard/steps';
import { StepKey } from './Wizard/types';
import { PreviewContentModal } from './preview/PreviewContentModal';
import { useNotificationsPreview } from './preview/useNotificationsPreview';
import { formatPreviewError, usePreviewContent } from './preview/usePreviewContent';
import { Step1Content, useStep1Validation } from './steps/Step1AlertmanagerResources';
import { Step2Content, useStep2Validation } from './steps/Step2AlertRules';
import { canRunDryRun } from './steps/utils';
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

function buildDryRunArgs(values: Step1Values): ValidateAlertmanagerConfigImportArgs | typeof skipToken {
  const canRun = canRunDryRun({
    policyTreeName: values.policyTreeName,
    notificationsSource: values.notificationsSource,
    notificationsYamlFile: values.notificationsYamlFile,
    notificationsDatasourceUID: values.notificationsDatasourceUID,
    notificationsTemplateFiles: values.notificationsTemplateFiles,
    autoSyncNotificationsEnabled: values.autoSyncNotificationsEnabled ?? false,
  });
  return canRun
    ? {
        source: values.notificationsSource,
        yamlFile: values.notificationsYamlFile,
        templateFiles: values.notificationsTemplateFiles,
        datasourceName: values.notificationsDatasourceName ?? undefined,
        configIdentifier: values.policyTreeName,
      }
    : skipToken;
}

const ImportToGMA = () => {
  return (
    <AlertingPageWrapper
      navId={getAlertRulesNavId()}
      pageNav={{
        text: t('alerting.import-to-gma-tool.pageTitle', 'Import to Grafana Alerting'),
      }}
    >
      <ImportWizardGate />
    </AlertingPageWrapper>
  );
};

function Wizard() {
  return (
    <StepperStateProvider>
      <ImportWizardContent />
    </StepperStateProvider>
  );
}

// Blocks the whole import flow while auto-sync is active. Mirrors how the menu entry point (useImportEntrypointState) gates the same action.
export function ImportWizardGate() {
  const { isActive, isLoading } = useIsAutoSyncActive();
  // Frozen on first resolution, not live: this only gates *entry*. Enabling auto-sync mid-wizard
  // (handleConfirmImport's own save) flips isActive via the same Config cache the mutation
  // invalidates — without freezing, that unmounts the wizard out from under its own in-flight submit.
  const [gateActive, setGateActive] = useState<boolean | null>(null);
  useEffect(() => {
    if (!isLoading && gateActive === null) {
      setGateActive(isActive);
    }
  }, [isLoading, isActive, gateActive]);

  if (isLoading || gateActive === null) {
    return <LoadingPlaceholder text={t('alerting.import-to-gma.loading', 'Loading…')} />;
  }
  if (gateActive) {
    return <AutoSyncActiveBlock />;
  }
  return <Wizard />;
}

function AutoSyncActiveBlock() {
  // Both the Alerting settings route and its nav entry are gated on the Org Admin role, so linking
  // anyone else there would bounce them to the home page. Rule import stays available to every user
  // who can reach the wizard: the sync worker mirrors only the Alertmanager configuration, and the
  // convert endpoint rejects notification imports alone.
  const canManageAutoSync = contextSrv.hasRole(OrgRole.Admin);
  return (
    <Alert severity="warning" title={t('alerting.import-to-gma.autosync-active-block.title', 'Auto-sync is enabled')}>
      <Stack direction="column" gap={1} alignItems="flex-start">
        <Text>
          <Trans i18nKey="alerting.import-to-gma.autosync-active-block.description">
            Grafana is continuously syncing alert configuration from a data source, so notification resources are a
            read-only mirror and cannot be imported into. You can still import alert rules.
          </Trans>
        </Text>
        {canManageAutoSync && (
          <Text>
            <Trans i18nKey="alerting.import-to-gma.autosync-active-block.disable-sync">
              To import notification resources, disable auto-sync in Alerting settings first.
            </Trans>
          </Text>
        )}
        <Stack direction="row" gap={2} alignItems="center" wrap="wrap">
          <TextLink href={createRelativeUrl(ALERTING_PATHS.IMPORT_DATASOURCE_MANAGED_RULES)} icon="upload">
            {t('alerting.import-to-gma.autosync-active-block.import-rules', 'Import alert rules')}
          </TextLink>
          {canManageAutoSync && (
            <TextLink href={ALERTING_IMPORT_SETTINGS_URL} icon="cog">
              {t('alerting.import-to-gma.autosync-active-block.go-to-settings', 'Go to Alerting settings')}
            </TextLink>
          )}
        </Stack>
      </Stack>
    </Alert>
  );
}

/**
 * Inner content component that uses the stepper state
 */
function ImportWizardContent() {
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

  const { watch, setValue, getValues } = formAPI;
  const [step1Completed, step1Skipped] = watch(['step1Completed', 'step1Skipped']);

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
  const liveDryRunArgs = useMemo(() => buildDryRunArgs(liveStep1Values), [liveStep1Values]);

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

  // Step 1 handlers
  // Note: WizardStep and NextButton handle stepper state (completed, skipped, visited, navigation)
  // These handlers only need to update form values and control whether to proceed.
  // Runs its own fresh, awaited check rather than trusting the debounced preview above, which can
  // lag the live inputs by design. The values it checks are snapshotted and are what the review and
  // import steps use, so what we validate is what we import.
  const handleStep1Next = useCallback(async (): Promise<boolean> => {
    const snapshot = pickStep1Values(getValues());
    const args = buildDryRunArgs(snapshot);
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
  }, [triggerDryRunCheck, setValue, getValues]);

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
      notifyApp.error(
        willEnableAutoSync
          ? t(
              'alerting.wizard-import-to-gma.autosync-rules-error',
              'Auto-sync was enabled, but importing alert rules failed.'
            )
          : t('alerting.wizard-import-to-gma.error', 'Failed to import resources'),
        stringifyErrorLike(err)
      );
    }
  }, [getImportValues, importNotifications, importRules, rulesFromDatasource, saveAutoSync, notifyApp]);

  const handleCancelConfirm = useCallback(() => {
    // Only allow closing if not importing
    if (importStatus !== 'importing') {
      setShowConfirmModal(false);
      setImportStatus('idle');
    }
  }, [importStatus]);

  const handleWizardCancel = useCallback(() => {
    const { formState } = formAPI;
    trackImportToGMAWizardCancelled({
      cancelledAtStep: activeStep,
      formDirty: formState.isDirty,
    });
  }, [activeStep, formAPI]);

  return (
    <>
      <Box marginBottom={3}>
        <Alert severity="info" title={t('alerting.import-to-gma.info-title', 'Import wizard')}>
          <Trans i18nKey="alerting.import-to-gma.info-description">
            This wizard helps you import alert rules and notification resources from external sources to Grafana
            Alerting. For more information, refer to the{' '}
            <TextLink href={DOCS_URL_ALERTING_MIGRATION} external>
              documentation
            </TextLink>
            .
          </Trans>
        </Alert>
      </Box>

      <FormProvider {...formAPI}>
        <WizardLayout>
          {/* Step 1: Notification Resources */}
          {activeStep === StepKey.Notifications && (
            <Step1Wrapper
              canImport={canImportNotifications}
              onNext={handleStep1Next}
              onSkip={handleStep1Skip}
              onCancel={handleWizardCancel}
              dryRunState={dryRunState}
              dryRunResult={dryRunResult}
              isChecking={isStep1Checking}
            />
          )}

          {/* Step 2: Alert Rules */}
          {activeStep === StepKey.Rules && (
            <Step2Wrapper
              step1Completed={step1Completed}
              step1Skipped={step1Skipped}
              canImport={canImportRules}
              onNext={handleStep2Next}
              onSkip={handleStep2Skip}
              onCancel={handleWizardCancel}
            />
          )}

          {/* Step 3: Review */}
          {activeStep === StepKey.Review && (
            <ReviewStep
              formData={formValues}
              onStartImport={handleStartImport}
              onCancel={handleWizardCancel}
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
  onNext: () => boolean | Promise<boolean>;
  onSkip: () => void;
  onCancel: () => void;
  dryRunState: DryRunState;
  dryRunResult?: DryRunValidationResult;
  /** Locks the inputs so they can't change while Next's check is validating them. */
  isChecking: boolean;
}

const step1FieldsetStyle = css({ border: 0, margin: 0, padding: 0, minWidth: 0 });

function Step1Wrapper({
  canImport,
  onNext,
  onSkip,
  onCancel,
  dryRunState,
  dryRunResult,
  isChecking,
}: Step1WrapperProps) {
  const isStep1Valid = useStep1Validation(canImport);

  return (
    <WizardStep
      stepId={StepKey.Notifications}
      label={t('alerting.import-to-gma.step1.heading', 'Import Notification Resources')}
      subHeader={
        <Trans i18nKey="alerting.import-to-gma.step1.subtitle">
          Import contact points, notification policies, templates, and mute timings from an external Alertmanager.
        </Trans>
      }
      onNext={onNext}
      onSkip={onSkip}
      onCancel={onCancel}
      canSkip
      skipLabel={t('alerting.import-to-gma.step1.skip', 'Skip this step')}
      disableNext={!isStep1Valid}
      disabledNextTooltip={t(
        'alerting.import-to-gma.step1.next-disabled-tooltip',
        'Complete the required fields before continuing.'
      )}
    >
      <fieldset disabled={isChecking} className={step1FieldsetStyle}>
        <Step1Content canImport={canImport} dryRunState={dryRunState} dryRunResult={dryRunResult} />
      </fieldset>
    </WizardStep>
  );
}

/**
 * Step 2 wrapper that uses the validation hook
 */
interface Step2WrapperProps {
  step1Completed: boolean;
  step1Skipped: boolean;
  canImport: boolean;
  onNext: () => boolean;
  onSkip: () => void;
  onCancel: () => void;
}

function Step2Wrapper({ step1Completed, step1Skipped, canImport, onNext, onSkip, onCancel }: Step2WrapperProps) {
  const isStep2Valid = useStep2Validation(canImport);

  return (
    <WizardStep
      stepId={StepKey.Rules}
      label={t('alerting.import-to-gma.step2.heading', 'Import Alert Rules')}
      subHeader={
        <Trans i18nKey="alerting.import-to-gma.step2.subtitle">
          Import alert rules and recording rules from an external source.
        </Trans>
      }
      onNext={onNext}
      onSkip={onSkip}
      onCancel={onCancel}
      canSkip
      skipLabel={t('alerting.import-to-gma.step2.skip', 'Skip this step')}
      disableNext={!isStep2Valid}
    >
      <Step2Content step1Completed={step1Completed} step1Skipped={step1Skipped} canImport={canImport} />
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
          Notification resources will not be imported.
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
  onCancel: () => void;
  dryRunResult?: DryRunValidationResult;
  rulesFromDatasource?: RulerRulesConfigDTO;
}

// True when a source is 'yaml' and its file has actually been uploaded (not just selected as the source type).
// Typed as a guard so callers get `file` narrowed to `File` afterwards, instead of a bare boolean.
function hasYamlUpload(source: string, file: File | null): file is File {
  return source === 'yaml' && file !== null;
}

function ReviewStep({ formData, onStartImport, onCancel, dryRunResult, rulesFromDatasource }: ReviewStepProps) {
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
        <Alert severity="warning" title={t('alerting.import-to-gma.review.nothing', 'Nothing to import')}>
          <Trans i18nKey="alerting.import-to-gma.review.nothing-desc">
            Both steps were skipped. Go back and configure at least one import source.
          </Trans>
        </Alert>
      ) : (
        <Stack direction="column" gap={2}>
          {/* Notifications Summary Card */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Text variant="h5" element="h3">
                {t('alerting.import-to-gma.review.notifications-title', 'Notification Resources')}
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
                {t('alerting.import-to-gma.review.rules-title', 'Alert Rules')}
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
            {t('alerting.import-to-gma.review.back', 'Alert rules')}
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
        <CancelButton onCancel={onCancel} />
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
          Auto-sync was enabled, but importing alert rules failed. Please check the error details and try again.
        </Trans>
      );
    }
    return autoSyncActive ? (
      <Trans i18nKey="alerting.import-to-gma.confirm.autosync-error-body">
        Failed to enable Auto-sync. Please check the error details and try again.
      </Trans>
    ) : (
      <Trans i18nKey="alerting.import-to-gma.confirm.error-body">
        Failed to import resources. Please check the error details and try again.
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

        {(isError || isPartialError) && <Text color="error">{getErrorBody()}</Text>}
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

export default withPageErrorBoundary(ImportToGMA);
