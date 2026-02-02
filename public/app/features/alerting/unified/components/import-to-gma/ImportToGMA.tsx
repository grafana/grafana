import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import { useCallback, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Alert, Box, Button, Icon, Modal, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { Folder } from '../../types/rule-form';
import { DOCS_URL_ALERTING_MIGRATION } from '../../utils/docs';
import { stringifyErrorLike } from '../../utils/misc';
import { createListFilterLink } from '../../utils/navigation';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertingPageWrapper } from '../AlertingPageWrapper';
import { useGetRulerRules } from '../rule-editor/useAlertRuleSuggestions';

import { DryRunValidationModal, DryRunValidationResult } from './DryRunValidationModal';
import { CancelButton } from './Wizard/CancelButton';
import { StepperStateProvider, useStepperState } from './Wizard/StepperState';
import { WizardLayout } from './Wizard/WizardLayout';
import { WizardStep } from './Wizard/WizardStep';
import { StepKey } from './Wizard/types';
import { Step1Content, useStep1Validation } from './steps/Step1AlertmanagerResources';
import { Step2Content, useStep2Validation } from './steps/Step2AlertRules';
import { filterRulerRulesConfig, useDryRunNotifications, useImportNotifications, useImportRules } from './useImport';

/**
 * Label name used in X-Grafana-Alerting-Merge-Matchers header.
 * We use __grafana_managed_route__ as the label name for merge matchers.
 * Alerts matching this label will be routed through the imported policy tree.
 */
export const MERGE_MATCHERS_LABEL_NAME = '__grafana_managed_route__';

export interface ImportFormValues {
  // Step 1: Alertmanager resources
  step1Completed: boolean;
  step1Skipped: boolean;
  /**
   * Name of the imported policy tree (value for __grafana_managed_route__ label).
   * For now, this is free-form as we don't have an API to retrieve the list of available policy trees.
   */
  policyTreeName: string;
  notificationsSource: 'datasource' | 'yaml';
  notificationsDatasourceUID?: string;
  notificationsDatasourceName: string | null;
  notificationsYamlFile: File | null;

  // Step 2: Alert rules
  step2Completed: boolean;
  step2Skipped: boolean;
  notificationPolicyOption: 'default' | 'imported' | 'manual';
  manualLabelName: string;
  manualLabelValue: string;
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

const ImportToGMA = () => {
  return (
    <AlertingPageWrapper
      navId="alert-list"
      pageNav={{
        text: t('alerting.import-to-gma-tool.pageTitle', 'Import to Grafana Alerting'),
      }}
    >
      <StepperStateProvider>
        <ImportWizardContent />
      </StepperStateProvider>
    </AlertingPageWrapper>
  );
};

/**
 * Inner content component that uses the stepper state
 */
function ImportWizardContent() {
  const { activeStep, setStepCompleted, setStepSkipped, setActiveStep, setVisitedStep, setStepErrors } =
    useStepperState();

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDryRunModal, setShowDryRunModal] = useState(false);
  const [dryRunState, setDryRunState] = useState<'loading' | 'success' | 'warning' | 'error'>('loading');
  const [dryRunResult, setDryRunResult] = useState<DryRunValidationResult | undefined>();
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle');

  const { runDryRun, reset: resetDryRun } = useDryRunNotifications();
  const importNotifications = useImportNotifications();
  const importRules = useImportRules();
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
      // Step 2
      step2Completed: false,
      step2Skipped: false,
      notificationPolicyOption: 'default',
      manualLabelName: '',
      manualLabelValue: '',
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
  const canImportNotifications = contextSrv.hasPermission(AccessControlAction.AlertingNotificationsWrite);
  const canImportRules =
    contextSrv.hasPermission(AccessControlAction.AlertingRuleCreate) &&
    contextSrv.hasPermission(AccessControlAction.AlertingProvisioningSetStatus);

  // Step 1 handlers
  const handleStep1Next = useCallback(async (): Promise<boolean> => {
    const formValues = getValues();
    const mergeMatchers = `${MERGE_MATCHERS_LABEL_NAME}=${formValues.policyTreeName}`;

    // Show the dry-run modal and start validation
    setShowDryRunModal(true);
    setDryRunState('loading');
    setDryRunResult(undefined);

    try {
      const result = await runDryRun(
        {
          source: formValues.notificationsSource,
          datasourceName: formValues.notificationsDatasourceName ?? undefined,
          yamlFile: formValues.notificationsYamlFile,
          mergeMatchers,
        },
        // TODO: Set skipValidation to false once the backend endpoint is implemented
        { skipValidation: true }
      );

      setDryRunResult(result);

      if (!result.valid) {
        setDryRunState('error');
        // Mark step as having errors
        setStepErrors(StepKey.Notifications, true);
      } else if (result.renamedReceivers.length > 0 || result.renamedTimeIntervals.length > 0) {
        setDryRunState('warning');
        // Warnings are not errors, step can still be completed
        setStepErrors(StepKey.Notifications, false);
      } else {
        setDryRunState('success');
        setStepErrors(StepKey.Notifications, false);
      }
    } catch (err) {
      setDryRunState('error');
      setDryRunResult({
        valid: false,
        error: err instanceof Error ? err.message : String(err),
        renamedReceivers: [],
        renamedTimeIntervals: [],
      });
      setStepErrors(StepKey.Notifications, true);
    }

    // Don't auto-proceed, wait for dry-run modal confirmation
    return false;
  }, [getValues, runDryRun, setStepErrors]);

  const handleDryRunConfirm = useCallback(() => {
    setValue('step1Completed', true);
    setValue('step1Skipped', false);
    setStepCompleted(StepKey.Notifications, true);
    setStepSkipped(StepKey.Notifications, false);
    setVisitedStep(StepKey.Notifications);
    setShowDryRunModal(false);
    resetDryRun();
    setActiveStep(StepKey.Rules);
  }, [setValue, setStepCompleted, setStepSkipped, setVisitedStep, setActiveStep, resetDryRun]);

  const handleDryRunDismiss = useCallback(() => {
    setShowDryRunModal(false);
    resetDryRun();
  }, [resetDryRun]);

  const handleStep1Skip = useCallback(() => {
    setValue('step1Completed', false);
    setValue('step1Skipped', true);
    setValue('notificationPolicyOption', 'default');
    setStepCompleted(StepKey.Notifications, false);
    setStepSkipped(StepKey.Notifications, true);
    setStepErrors(StepKey.Notifications, false);
    setVisitedStep(StepKey.Notifications);
    setActiveStep(StepKey.Rules);
  }, [setValue, setStepCompleted, setStepSkipped, setStepErrors, setVisitedStep, setActiveStep]);

  // Step 2 handlers
  const handleStep2Next = useCallback((): boolean => {
    setValue('step2Completed', true);
    setValue('step2Skipped', false);
    setStepCompleted(StepKey.Rules, true);
    setStepSkipped(StepKey.Rules, false);
    setStepErrors(StepKey.Rules, false);
    setVisitedStep(StepKey.Rules);
    return true;
  }, [setValue, setStepCompleted, setStepSkipped, setStepErrors, setVisitedStep]);

  const handleStep2Skip = useCallback(() => {
    setValue('step2Completed', false);
    setValue('step2Skipped', true);
    setStepCompleted(StepKey.Rules, false);
    setStepSkipped(StepKey.Rules, true);
    setStepErrors(StepKey.Rules, false);
    setVisitedStep(StepKey.Rules);
    setActiveStep(StepKey.Review);
  }, [setValue, setStepCompleted, setStepSkipped, setStepErrors, setVisitedStep, setActiveStep]);

  // Get ruler rules for rules import (needed when importing from datasource)
  const formValues = getValues();
  const shouldFetchRules =
    formValues.step2Completed && !formValues.step2Skipped && formValues.rulesSource === 'datasource';
  const { rulerRules: rulesFromDatasource } = useGetRulerRules(
    shouldFetchRules ? (formValues.rulesDatasourceName ?? undefined) : undefined
  );

  const handleStartImport = useCallback(() => {
    setShowConfirmModal(true);
  }, []);

  const handleConfirmImport = useCallback(async () => {
    setImportStatus('importing');

    const values = getValues();
    const willImportNotifications = values.step1Completed && !values.step1Skipped;
    const willImportRules = values.step2Completed && !values.step2Skipped;

    try {
      const notificationsLabel = `${MERGE_MATCHERS_LABEL_NAME}=${values.policyTreeName}`;

      // Import notifications first (if step 1 was completed)
      if (willImportNotifications) {
        await importNotifications({
          source: values.notificationsSource,
          datasourceName: values.notificationsDatasourceName ?? undefined,
          yamlFile: values.notificationsYamlFile,
          mergeMatchers: notificationsLabel,
        });
      }

      // Then import rules (if step 2 was completed)
      if (willImportRules && values.rulesDatasourceUID) {
        // Get the filtered rules payload
        let rulesPayload: RulerRulesConfigDTO = {};

        if (values.rulesSource === 'datasource' && rulesFromDatasource) {
          const { filteredConfig } = filterRulerRulesConfig(rulesFromDatasource, values.namespace, values.ruleGroup);
          rulesPayload = filteredConfig;
        }

        // Calculate extra labels based on notification policy option
        let extraLabels: string | undefined;
        if (values.notificationPolicyOption === 'imported') {
          extraLabels = `${MERGE_MATCHERS_LABEL_NAME}=${values.policyTreeName}`;
        } else if (values.notificationPolicyOption === 'manual') {
          extraLabels = `${values.manualLabelName}=${values.manualLabelValue}`;
        }

        await importRules({
          dataSourceUID: values.rulesDatasourceUID,
          targetFolderUID: values.targetFolder?.uid,
          pauseAlertingRules: values.pauseAlertingRules,
          pauseRecordingRules: values.pauseRecordingRules,
          payload: rulesPayload,
          targetDatasourceUID: values.targetDatasourceUID,
          extraLabels,
        });
      }

      setImportStatus('success');

      // Redirect to alert list with folder filter after a short delay
      const targetFolder = values.targetFolder;
      const isRootFolder = isEmpty(targetFolder?.uid);
      const ruleListUrl = createListFilterLink(isRootFolder ? [] : [['namespace', targetFolder?.title ?? '']], {
        skipSubPath: true,
      });

      setTimeout(() => {
        setShowConfirmModal(false);
        notifyApp.success(t('alerting.import-to-gma.success', 'Successfully imported resources to Grafana Alerting.'));
        locationService.push(ruleListUrl);
      }, 1500);
    } catch (err) {
      setImportStatus('error');
      notifyApp.error(t('alerting.import-to-gma.error', 'Failed to import resources'), stringifyErrorLike(err));
    }
  }, [getValues, importNotifications, importRules, rulesFromDatasource, notifyApp]);

  const handleCancelConfirm = useCallback(() => {
    // Only allow closing if not importing
    if (importStatus !== 'importing') {
      setShowConfirmModal(false);
      setImportStatus('idle');
    }
  }, [importStatus]);

  return (
    <>
      <Box marginBottom={3}>
        <Alert severity="info" title={t('alerting.import-to-gma.info-title', 'Import wizard')}>
          <Trans i18nKey="alerting.import-to-gma.info-description">
            This wizard helps you import alert rules and notification resources from external sources to Grafana
            Alerting. For more information, refer to the{' '}
            <a href={DOCS_URL_ALERTING_MIGRATION} target="_blank" rel="noreferrer">
              documentation
            </a>
            .
          </Trans>
        </Alert>
      </Box>

      <FormProvider {...formAPI}>
        <WizardLayout>
          {/* Step 1: Notification Resources */}
          {activeStep === StepKey.Notifications && (
            <Step1Wrapper canImport={canImportNotifications} onNext={handleStep1Next} onSkip={handleStep1Skip} />
          )}

          {/* Step 2: Alert Rules */}
          {activeStep === StepKey.Rules && (
            <Step2Wrapper
              step1Completed={step1Completed}
              step1Skipped={step1Skipped}
              canImport={canImportRules}
              onNext={handleStep2Next}
              onSkip={handleStep2Skip}
            />
          )}

          {/* Step 3: Review */}
          {activeStep === StepKey.Review && (
            <ReviewStep formData={getValues()} onStartImport={handleStartImport} dryRunResult={dryRunResult} />
          )}
        </WizardLayout>
      </FormProvider>

      {/* Confirm Import Modal */}
      <ConfirmImportModal
        isOpen={showConfirmModal}
        importStatus={importStatus}
        onConfirm={handleConfirmImport}
        onDismiss={handleCancelConfirm}
      />

      {/* Dry-run Validation Modal */}
      <DryRunValidationModal
        isOpen={showDryRunModal}
        onDismiss={handleDryRunDismiss}
        onConfirm={handleDryRunConfirm}
        state={dryRunState}
        result={dryRunResult}
      />
    </>
  );
}

/**
 * Step 1 wrapper that uses the validation hook
 */
interface Step1WrapperProps {
  canImport: boolean;
  onNext: () => Promise<boolean>;
  onSkip: () => void;
}

function Step1Wrapper({ canImport, onNext, onSkip }: Step1WrapperProps) {
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
      canSkip
      skipLabel={t('alerting.import-to-gma.step1.skip', 'Skip this step')}
      disableNext={!isStep1Valid}
    >
      <Step1Content canImport={canImport} />
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
}

function Step2Wrapper({ step1Completed, step1Skipped, canImport, onNext, onSkip }: Step2WrapperProps) {
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
      canSkip
      skipLabel={t('alerting.import-to-gma.step2.skip', 'Skip this step')}
      disableNext={!isStep2Valid}
    >
      <Step2Content step1Completed={step1Completed} step1Skipped={step1Skipped} canImport={canImport} />
    </WizardStep>
  );
}

// Helper function for pause rules label
function getPauseRulesLabel(pauseAlertingRules: boolean, pauseRecordingRules: boolean): string {
  if (pauseAlertingRules && pauseRecordingRules) {
    return t('alerting.import-to-gma.review.pause-all', 'All rules paused');
  }
  if (pauseAlertingRules) {
    return t('alerting.import-to-gma.review.pause-alerting', 'Alert rules paused');
  }
  if (pauseRecordingRules) {
    return t('alerting.import-to-gma.review.pause-recording', 'Recording rules paused');
  }
  return t('alerting.import-to-gma.review.pause-none', 'No rules paused');
}

// Validation Status Indicator Component
interface ValidationStatusIndicatorProps {
  result: DryRunValidationResult;
  styles: ReturnType<typeof getStyles>;
}

function ValidationStatusIndicator({ result, styles }: ValidationStatusIndicatorProps) {
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
        {result.renamedReceivers.length > 0 && (
          <Text color="secondary" variant="bodySmall">
            {t('alerting.import-to-gma.review.renamed-receivers', 'Receivers renamed: {{count}}', {
              count: result.renamedReceivers.length,
            })}
          </Text>
        )}
        {result.renamedTimeIntervals.length > 0 && (
          <Text color="secondary" variant="bodySmall">
            {t('alerting.import-to-gma.review.renamed-intervals', 'Time intervals renamed: {{count}}', {
              count: result.renamedTimeIntervals.length,
            })}
          </Text>
        )}
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

// Review Step Component
interface ReviewStepProps {
  formData: ImportFormValues;
  onStartImport: () => void;
  dryRunResult?: DryRunValidationResult;
}

function ReviewStep({ formData, onStartImport, dryRunResult }: ReviewStepProps) {
  const styles = useStyles2(getStyles);
  const { setActiveStep } = useStepperState();

  const willImportNotifications = formData.step1Completed && !formData.step1Skipped;
  const willImportRules = formData.step2Completed && !formData.step2Skipped;
  const nothingToImport = !willImportNotifications && !willImportRules;

  const handleBack = () => {
    setActiveStep(StepKey.Rules);
  };

  return (
    <Stack direction="column" gap={3}>
      <Box>
        <Text variant="h4" element="h2">
          {t('alerting.import-to-gma.review.heading', 'Review Import')}
        </Text>
        <Text color="secondary">
          <Trans i18nKey="alerting.import-to-gma.review.subtitle">
            Review each section and once you are happy, start the migration.
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
              {willImportNotifications && (
                <span className={styles.badge}>{t('alerting.import-to-gma.review.will-import', 'Will import')}</span>
              )}
              {formData.step1Skipped && (
                <span className={styles.badgeSkipped}>{t('alerting.import-to-gma.review.skipped', 'Skipped')}</span>
              )}
            </div>
            <div className={styles.cardContent}>
              {willImportNotifications ? (
                <Stack direction="column" gap={1}>
                  <div className={styles.row}>
                    <Text color="secondary">{t('alerting.import-to-gma.review.source', 'Source')}</Text>
                    <Text>
                      {formData.notificationsSource === 'yaml'
                        ? formData.notificationsYamlFile?.name || 'YAML file'
                        : formData.notificationsDatasourceName || 'Data source'}
                    </Text>
                  </div>
                  <div className={styles.row}>
                    <Text color="secondary">{t('alerting.import-to-gma.review.policy-tree', 'Policy tree')}</Text>
                    <Text weight="medium">
                      {MERGE_MATCHERS_LABEL_NAME}={formData.policyTreeName}
                    </Text>
                  </div>
                  {dryRunResult && (
                    <Box marginTop={1}>
                      <ValidationStatusIndicator result={dryRunResult} styles={styles} />
                    </Box>
                  )}
                </Stack>
              ) : (
                <Text color="secondary">
                  <Trans i18nKey="alerting.import-to-gma.review.notifications-skipped">
                    Notification resources will not be imported.
                  </Trans>
                </Text>
              )}
            </div>
          </div>

          {/* Rules Summary Card */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Text variant="h5" element="h3">
                {t('alerting.import-to-gma.review.rules-title', 'Alert Rules')}
              </Text>
              {willImportRules && (
                <span className={styles.badge}>{t('alerting.import-to-gma.review.will-import', 'Will import')}</span>
              )}
              {formData.step2Skipped && (
                <span className={styles.badgeSkipped}>{t('alerting.import-to-gma.review.skipped', 'Skipped')}</span>
              )}
            </div>
            <div className={styles.cardContent}>
              {willImportRules ? (
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
                      {formData.notificationPolicyOption === 'default' &&
                        t('alerting.import-to-gma.review.routing-default', 'Default Grafana policy')}
                      {formData.notificationPolicyOption === 'imported' &&
                        t('alerting.import-to-gma.review.routing-imported', 'Imported policy ({{label}}={{value}})', {
                          label: MERGE_MATCHERS_LABEL_NAME,
                          value: formData.policyTreeName,
                        })}
                      {formData.notificationPolicyOption === 'manual' &&
                        t('alerting.import-to-gma.review.routing-manual', 'Manual label ({{label}}={{value}})', {
                          label: formData.manualLabelName,
                          value: formData.manualLabelValue,
                        })}
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
                    <Text>{getPauseRulesLabel(formData.pauseAlertingRules, formData.pauseRecordingRules)}</Text>
                  </div>
                </Stack>
              ) : (
                <Text color="secondary">
                  <Trans i18nKey="alerting.import-to-gma.review.rules-skipped">Alert rules will not be imported.</Trans>
                </Text>
              )}
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
          <Button variant="primary" icon="upload" onClick={onStartImport} disabled={nothingToImport}>
            {t('alerting.import-to-gma.review.start', 'Start import')}
          </Button>
        </Stack>
        <CancelButton />
      </Stack>
    </Stack>
  );
}

// Confirm Import Modal Component
interface ConfirmImportModalProps {
  isOpen: boolean;
  importStatus: 'idle' | 'importing' | 'success' | 'error';
  onConfirm: () => void;
  onDismiss: () => void;
}

function ConfirmImportModal({ isOpen, importStatus, onConfirm, onDismiss }: ConfirmImportModalProps) {
  const isImporting = importStatus === 'importing';
  const isSuccess = importStatus === 'success';
  const isError = importStatus === 'error';

  const getTitle = () => {
    if (isImporting) {
      return t('alerting.import-to-gma.confirm.importing-title', 'Importing...');
    }
    if (isSuccess) {
      return t('alerting.import-to-gma.confirm.success-title', 'Import Successful');
    }
    if (isError) {
      return t('alerting.import-to-gma.confirm.error-title', 'Import Failed');
    }
    return t('alerting.import-to-gma.confirm.title', 'Confirm Import');
  };

  return (
    <Modal isOpen={isOpen} title={getTitle()} onDismiss={onDismiss}>
      <Stack direction="column" gap={2}>
        {importStatus === 'idle' && (
          <Text>
            <Trans i18nKey="alerting.import-to-gma.confirm.body">
              Are you sure you want to start the import? This action will create new resources in Grafana Alerting.
            </Trans>
          </Text>
        )}

        {isImporting && (
          <Stack direction="row" gap={2} alignItems="center">
            <Spinner />
            <Text>
              <Trans i18nKey="alerting.import-to-gma.confirm.importing-body">
                Importing resources to Grafana Alerting. Please wait...
              </Trans>
            </Text>
          </Stack>
        )}

        {isSuccess && (
          <Stack direction="row" gap={2} alignItems="center">
            <Icon name="check-circle" size="xl" color="green" />
            <Text>
              <Trans i18nKey="alerting.import-to-gma.confirm.success-body">
                Resources imported successfully. Redirecting...
              </Trans>
            </Text>
          </Stack>
        )}

        {isError && (
          <Text color="error">
            <Trans i18nKey="alerting.import-to-gma.confirm.error-body">
              Failed to import resources. Please check the error details and try again.
            </Trans>
          </Text>
        )}
      </Stack>

      <Modal.ButtonRow>
        {importStatus === 'idle' && (
          <>
            <Button variant="secondary" onClick={onDismiss}>
              {t('alerting.common.cancel', 'Cancel')}
            </Button>
            <Button variant="primary" fill="solid" onClick={onConfirm}>
              {t('alerting.import-to-gma.confirm.confirm', 'Start Import')}
            </Button>
          </>
        )}

        {isError && (
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
  badge: css({
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.success.transparent,
    color: theme.colors.success.text,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  badgeSkipped: css({
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.warning.transparent,
    color: theme.colors.warning.text,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  successIcon: css({
    color: theme.colors.success.main,
  }),
  warningIcon: css({
    color: theme.colors.warning.main,
  }),
  errorIcon: css({
    color: theme.colors.error.main,
  }),
});

export default withPageErrorBoundary(ImportToGMA);
