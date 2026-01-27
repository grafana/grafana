import { css } from '@emotion/css';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Box, Icon, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { Folder } from '../../types/rule-form';
import { DOCS_URL_ALERTING_MIGRATION } from '../../utils/docs';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertingPageWrapper } from '../AlertingPageWrapper';

import { MigrationPreviewModal } from './MigrationPreviewModal';
import { Step1AlertmanagerResources } from './steps/Step1AlertmanagerResources';
import { Step2AlertRules } from './steps/Step2AlertRules';

/** Default label name used for migration - links imported rules to notification policies */
export const DEFAULT_MIGRATION_LABEL_NAME = 'importedLabel';

export interface MigrationFormValues {
  // Step 1: Alertmanager resources
  step1Completed: boolean;
  step1Skipped: boolean;
  migrationLabelName: string;
  migrationLabelValue: string;
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

interface StepDefinition {
  id: number;
  title: string;
  description: string;
}

const MigrateToGMA = () => {
  const styles = useStyles2(getStyles);
  const [currentStep, setCurrentStep] = useState(0);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const formAPI = useForm<MigrationFormValues>({
    defaultValues: {
      // Step 1
      step1Completed: false,
      step1Skipped: false,
      migrationLabelName: DEFAULT_MIGRATION_LABEL_NAME,
      migrationLabelValue: '',
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

  const { watch, setValue } = formAPI;
  const [step1Completed, step1Skipped, step2Completed, step2Skipped] = watch([
    'step1Completed',
    'step1Skipped',
    'step2Completed',
    'step2Skipped',
  ]);

  // Permission checks aligned with backend authorization.go
  // Step 1 (notifications): AlertingNotificationsWrite
  // Step 2 (rules): AlertingRuleCreate AND AlertingProvisioningSetStatus
  const canImportNotifications = contextSrv.hasPermission(AccessControlAction.AlertingNotificationsWrite);
  const canImportRules =
    contextSrv.hasPermission(AccessControlAction.AlertingRuleCreate) &&
    contextSrv.hasPermission(AccessControlAction.AlertingProvisioningSetStatus);

  const steps: StepDefinition[] = [
    {
      id: 1,
      title: t('alerting.migrate-to-gma.step1.nav-title', 'Import notifications'),
      description: t('alerting.migrate-to-gma.step1.nav-desc', 'Contact points, policies, templates'),
    },
    {
      id: 2,
      title: t('alerting.migrate-to-gma.step2.nav-title', 'Import alert rules'),
      description: t('alerting.migrate-to-gma.step2.nav-desc', 'Alert and recording rules'),
    },
    {
      id: 3,
      title: t('alerting.migrate-to-gma.step3.nav-title', 'Review'),
      description: t('alerting.migrate-to-gma.step3.nav-desc', 'Preview and confirm migration'),
    },
  ];

  const getStepIndicatorClassName = (
    status: 'completed' | 'current' | 'pending',
    styleClasses: ReturnType<typeof getStyles>
  ) => {
    if (status === 'completed') {
      return styleClasses.stepIndicatorCompleted;
    }
    if (status === 'current') {
      return styleClasses.stepIndicatorCurrent;
    }
    return styleClasses.stepIndicatorPending;
  };

  const getStepStatus = (stepIndex: number): 'completed' | 'current' | 'pending' => {
    // Determine actual completion state from form data (not just currentStep position)
    const isStep1Done = step1Completed || step1Skipped;
    const isStep2Done = step2Completed || step2Skipped;

    if (stepIndex === currentStep) {
      return 'current';
    }

    // Check actual completion state for each step
    if (stepIndex === 0) {
      return isStep1Done ? 'completed' : 'pending';
    }
    if (stepIndex === 1) {
      return isStep2Done ? 'completed' : 'pending';
    }
    // Step 3 (Review) - only shown as completed after successful migration (handled by modal)
    return 'pending';
  };

  const handleStep1Complete = () => {
    setValue('step1Completed', true);
    setValue('step1Skipped', false);
    setCurrentStep(1);
  };

  const handleStep1Skip = () => {
    setValue('step1Completed', false);
    setValue('step1Skipped', true);
    setValue('notificationPolicyOption', 'default');
    setCurrentStep(1);
  };

  const handleStep2Complete = () => {
    setValue('step2Completed', true);
    setValue('step2Skipped', false);
    setCurrentStep(2);
  };

  const handleStep2Skip = () => {
    setValue('step2Completed', false);
    setValue('step2Skipped', true);
    setCurrentStep(2);
  };

  const handleBackToStep1 = () => {
    setCurrentStep(0);
  };

  const handleBackToStep2 = () => {
    setCurrentStep(1);
  };

  const handleStartMigration = () => {
    setShowPreviewModal(true);
  };

  const handleStepClick = (stepIndex: number) => {
    // Only allow clicking on completed steps or the current step
    if (stepIndex <= currentStep) {
      setCurrentStep(stepIndex);
    }
  };

  return (
    <AlertingPageWrapper
      navId="alert-list"
      pageNav={{
        text: t('alerting.migrate-to-gma.pageTitle', 'Migrate to Grafana Alerting'),
      }}
    >
      <div className={styles.container}>
        {/* Sidebar with steps */}
        <div className={styles.sidebar}>
          <div className={styles.stepsList}>
            {steps.map((step, index) => {
              const status = getStepStatus(index);
              return (
                <button
                  key={step.id}
                  className={styles.stepItem}
                  onClick={() => handleStepClick(index)}
                  disabled={index > currentStep}
                  type="button"
                >
                  <div className={styles.stepIndicatorContainer}>
                    <div className={getStepIndicatorClassName(status, styles)}>
                      {status === 'completed' ? <Icon name="check" size="sm" /> : <span>{step.id}</span>}
                    </div>
                    {index < steps.length - 1 && <div className={styles.stepLine} />}
                  </div>
                  <div className={styles.stepContent}>
                    <Text
                      weight={status === 'current' ? 'bold' : 'regular'}
                      color={status === 'pending' ? 'secondary' : undefined}
                    >
                      {step.title}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                      {step.description}
                    </Text>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main content area */}
        <div className={styles.mainContent}>
          <Box marginBottom={3}>
            <Alert severity="info" title={t('alerting.migrate-to-gma.info-title', 'Migration wizard')}>
              <Trans i18nKey="alerting.migrate-to-gma.info-description">
                This wizard helps you migrate alert rules and notification resources from external sources to Grafana
                Alerting. For more information, refer to the{' '}
                <a href={DOCS_URL_ALERTING_MIGRATION} target="_blank" rel="noreferrer">
                  documentation
                </a>
                .
              </Trans>
            </Alert>
          </Box>

          <FormProvider {...formAPI}>
            {/* Step 1: Alertmanager Resources */}
            {currentStep === 0 && (
              <Step1AlertmanagerResources
                onComplete={handleStep1Complete}
                onSkip={handleStep1Skip}
                canImport={canImportNotifications}
              />
            )}

            {/* Step 2: Alert Rules */}
            {currentStep === 1 && (
              <Step2AlertRules
                onComplete={handleStep2Complete}
                onSkip={handleStep2Skip}
                onBack={handleBackToStep1}
                step1Completed={step1Completed}
                step1Skipped={step1Skipped}
                canImport={canImportRules}
              />
            )}

            {/* Step 3: Review */}
            {currentStep === 2 && (
              <ReviewStep
                formData={formAPI.getValues()}
                onBack={handleBackToStep2}
                onStartMigration={handleStartMigration}
              />
            )}
          </FormProvider>

          {/* Cancel link */}
          <Box marginTop={3}>
            <LinkButton variant="secondary" href="/alerting/list" fill="text">
              {t('alerting.migrate-to-gma.cancel', 'Cancel and go back')}
            </LinkButton>
          </Box>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreviewModal && (
        <MigrationPreviewModal formData={formAPI.getValues()} onDismiss={() => setShowPreviewModal(false)} />
      )}
    </AlertingPageWrapper>
  );
};

// Helper function for pause rules label
function getPauseRulesLabel(pauseAlertingRules: boolean, pauseRecordingRules: boolean): string {
  if (pauseAlertingRules && pauseRecordingRules) {
    return t('alerting.migrate-to-gma.review.pause-all', 'All rules paused');
  }
  if (pauseAlertingRules) {
    return t('alerting.migrate-to-gma.review.pause-alerting', 'Alert rules paused');
  }
  if (pauseRecordingRules) {
    return t('alerting.migrate-to-gma.review.pause-recording', 'Recording rules paused');
  }
  return t('alerting.migrate-to-gma.review.pause-none', 'No rules paused');
}

// Review Step Component
interface ReviewStepProps {
  formData: MigrationFormValues;
  onBack: () => void;
  onStartMigration: () => void;
}

function ReviewStep({ formData, onBack, onStartMigration }: ReviewStepProps) {
  const styles = useStyles2(getStyles);

  const willMigrateNotifications = formData.step1Completed && !formData.step1Skipped;
  const willMigrateRules = formData.step2Completed && !formData.step2Skipped;
  const nothingToMigrate = !willMigrateNotifications && !willMigrateRules;

  return (
    <Stack direction="column" gap={3}>
      <Box>
        <Text variant="h3" element="h2">
          {t('alerting.migrate-to-gma.review.heading', '3. Review Migration')}
        </Text>
        <Text color="secondary">
          <Trans i18nKey="alerting.migrate-to-gma.review.subtitle">
            Review each section and once you are happy, start the migration.
          </Trans>
        </Text>
      </Box>

      {nothingToMigrate ? (
        <Alert severity="warning" title={t('alerting.migrate-to-gma.review.nothing', 'Nothing to migrate')}>
          <Trans i18nKey="alerting.migrate-to-gma.review.nothing-desc">
            Both steps were skipped. Go back and configure at least one import source.
          </Trans>
        </Alert>
      ) : (
        <Stack direction="column" gap={2}>
          {/* Notifications Summary Card */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Text variant="h5" element="h3">
                {t('alerting.migrate-to-gma.review.notifications-title', 'Notification Resources')}
              </Text>
              {willMigrateNotifications && (
                <span className={styles.badge}>{t('alerting.migrate-to-gma.review.will-import', 'Will import')}</span>
              )}
              {formData.step1Skipped && (
                <span className={styles.badgeSkipped}>{t('alerting.migrate-to-gma.review.skipped', 'Skipped')}</span>
              )}
            </div>
            <div className={styles.cardContent}>
              {willMigrateNotifications ? (
                <Stack direction="column" gap={1}>
                  <div className={styles.row}>
                    <Text color="secondary">{t('alerting.migrate-to-gma.review.source', 'Source')}</Text>
                    <Text>
                      {formData.notificationsSource === 'yaml'
                        ? formData.notificationsYamlFile?.name || 'YAML file'
                        : formData.notificationsDatasourceName || 'Data source'}
                    </Text>
                  </div>
                  <div className={styles.row}>
                    <Text color="secondary">{t('alerting.migrate-to-gma.review.label', 'Migration label')}</Text>
                    <Text weight="medium">
                      {formData.migrationLabelName}={formData.migrationLabelValue}
                    </Text>
                  </div>
                </Stack>
              ) : (
                <Text color="secondary">
                  <Trans i18nKey="alerting.migrate-to-gma.review.notifications-skipped">
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
                {t('alerting.migrate-to-gma.review.rules-title', 'Alert Rules')}
              </Text>
              {willMigrateRules && (
                <span className={styles.badge}>{t('alerting.migrate-to-gma.review.will-import', 'Will import')}</span>
              )}
              {formData.step2Skipped && (
                <span className={styles.badgeSkipped}>{t('alerting.migrate-to-gma.review.skipped', 'Skipped')}</span>
              )}
            </div>
            <div className={styles.cardContent}>
              {willMigrateRules ? (
                <Stack direction="column" gap={1}>
                  <div className={styles.row}>
                    <Text color="secondary">{t('alerting.migrate-to-gma.review.source', 'Source')}</Text>
                    <Text>
                      {formData.rulesSource === 'yaml'
                        ? formData.rulesYamlFile?.name || 'YAML file'
                        : formData.rulesDatasourceName || 'Data source'}
                    </Text>
                  </div>
                  <div className={styles.row}>
                    <Text color="secondary">{t('alerting.migrate-to-gma.review.routing', 'Notification routing')}</Text>
                    <Text>
                      {formData.notificationPolicyOption === 'default' &&
                        t('alerting.migrate-to-gma.review.routing-default', 'Default Grafana policy')}
                      {formData.notificationPolicyOption === 'imported' &&
                        t('alerting.migrate-to-gma.review.routing-imported', 'Imported policy ({{label}}={{value}})', {
                          label: formData.migrationLabelName,
                          value: formData.migrationLabelValue,
                        })}
                      {formData.notificationPolicyOption === 'manual' &&
                        t('alerting.migrate-to-gma.review.routing-manual', 'Manual label ({{label}}={{value}})', {
                          label: formData.manualLabelName,
                          value: formData.manualLabelValue,
                        })}
                    </Text>
                  </div>
                  {(formData.namespace || formData.ruleGroup) && (
                    <div className={styles.row}>
                      <Text color="secondary">{t('alerting.migrate-to-gma.review.filter', 'Filter')}</Text>
                      <Text>
                        {formData.namespace &&
                          !formData.ruleGroup &&
                          `${t('alerting.migrate-to-gma.review.namespace', 'Namespace')}: ${formData.namespace}`}
                        {formData.namespace && formData.ruleGroup && `${formData.namespace} / ${formData.ruleGroup}`}
                      </Text>
                    </div>
                  )}
                  {formData.targetFolder && (
                    <div className={styles.row}>
                      <Text color="secondary">{t('alerting.migrate-to-gma.review.folder', 'Target folder')}</Text>
                      <Text>{formData.targetFolder.title}</Text>
                    </div>
                  )}
                  <div className={styles.row}>
                    <Text color="secondary">{t('alerting.migrate-to-gma.review.pause', 'Pause rules')}</Text>
                    <Text>{getPauseRulesLabel(formData.pauseAlertingRules, formData.pauseRecordingRules)}</Text>
                  </div>
                </Stack>
              ) : (
                <Text color="secondary">
                  <Trans i18nKey="alerting.migrate-to-gma.review.rules-skipped">
                    Alert rules will not be imported.
                  </Trans>
                </Text>
              )}
            </div>
          </div>
        </Stack>
      )}

      {/* Action buttons */}
      <Stack direction="row" gap={2}>
        <button type="button" className={styles.buttonSecondary} onClick={onBack}>
          {t('alerting.migrate-to-gma.review.back', '← Back to alert rules')}
        </button>
        <button type="button" className={styles.buttonPrimary} onClick={onStartMigration} disabled={nothingToMigrate}>
          <Icon name="upload" />
          {t('alerting.migrate-to-gma.review.start', 'Start migration')}
        </button>
      </Stack>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    gap: theme.spacing(4),
    minHeight: '600px',
  }),
  sidebar: css({
    width: '280px',
    flexShrink: 0,
    paddingTop: theme.spacing(2),
  }),
  stepsList: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  stepItem: css({
    display: 'flex',
    gap: theme.spacing(2),
    padding: theme.spacing(1, 0),
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    '&:disabled': {
      cursor: 'default',
      opacity: 0.7,
    },
  }),
  stepIndicatorContainer: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
  }),
  stepIndicatorCompleted: css({
    width: 28,
    height: 28,
    borderRadius: theme.shape.radius.circle,
    backgroundColor: theme.colors.success.main,
    color: theme.colors.success.contrastText,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: theme.typography.fontWeightBold,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  stepIndicatorCurrent: css({
    width: 28,
    height: 28,
    borderRadius: theme.shape.radius.circle,
    backgroundColor: theme.colors.primary.main,
    color: theme.colors.primary.contrastText,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: theme.typography.fontWeightBold,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  stepIndicatorPending: css({
    width: 28,
    height: 28,
    borderRadius: theme.shape.radius.circle,
    backgroundColor: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.medium}`,
    color: theme.colors.text.secondary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: theme.typography.fontWeightBold,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  stepLine: css({
    width: 2,
    height: 40,
    backgroundColor: theme.colors.border.medium,
    marginTop: theme.spacing(1),
  }),
  stepContent: css({
    display: 'flex',
    flexDirection: 'column',
    paddingTop: theme.spacing(0.5),
  }),
  mainContent: css({
    flex: 1,
    maxWidth: '800px',
  }),
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
  buttonPrimary: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.primary.main,
    color: theme.colors.primary.contrastText,
    border: 'none',
    cursor: 'pointer',
    fontWeight: theme.typography.fontWeightMedium,
    '&:hover': {
      backgroundColor: theme.colors.primary.shade,
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  }),
  buttonSecondary: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
    borderRadius: theme.shape.radius.default,
    backgroundColor: 'transparent',
    color: theme.colors.text.primary,
    border: `1px solid ${theme.colors.border.medium}`,
    cursor: 'pointer',
    fontWeight: theme.typography.fontWeightMedium,
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),
});

export default withPageErrorBoundary(MigrateToGMA);
