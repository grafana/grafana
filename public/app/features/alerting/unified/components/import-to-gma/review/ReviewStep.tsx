import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import { getRoutingTreeDisplayName } from '@grafana/alerting/unstable';
import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Badge, Box, Button, Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { type RulerCloudRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { RenamedResourcesList } from '../CollapsibleRenameList';
import { PolicyTreeNameHelp } from '../PolicyTreeNameHelp';
import { useStepperState } from '../Wizard/StepperState';
import { getImportPlan, getPauseRulesLabel } from '../Wizard/steps';
import { StepKey } from '../Wizard/types';
import { PreviewContentModal } from '../preview/PreviewContentModal';
import { useNotificationsPreview } from '../preview/useNotificationsPreview';
import { formatPreviewError, usePreviewContent } from '../preview/usePreviewContent';
import { type DryRunValidationResult, type ImportFormValues } from '../types';

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
      {formData.rulesSource === 'yaml' && formData.yamlImportTargetDatasourceUID && (
        <div className={styles.row}>
          <Text color="secondary">{t('alerting.import-to-gma.review.yaml-datasource', 'Data source')}</Text>
          <Text>{formData.yamlImportTargetDatasourceName ?? formData.yamlImportTargetDatasourceUID}</Text>
        </div>
      )}
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
  /** The rules the import will send, already filtered. Only set for a data source. */
  rulesToImport?: RulerCloudRulesConfigDTO;
  /** The rules file is still being read, so the rules to send are not known yet. */
  isLoadingRules?: boolean;
}

// True when a source is 'yaml' and its file has actually been uploaded (not just selected as the source type).
// Typed as a guard so callers get `file` narrowed to `File` afterwards, instead of a bare boolean.
function hasYamlUpload(source: string, file: File | null): file is File {
  return source === 'yaml' && file !== null;
}

export function ReviewStep({ formData, onStartImport, dryRunResult, rulesToImport, isLoadingRules }: ReviewStepProps) {
  const styles = useStyles2(getStyles);
  const { setActiveStep } = useStepperState();

  const { willImportNotifications, willImportRules, willEnableAutoSync } = getImportPlan(formData);
  const notificationsPreview = useNotificationsPreview(formData, { enabled: willImportNotifications });
  const rulesPreview = usePreviewContent('');

  const nothingToImport = !willImportNotifications && !willImportRules;

  const handleBack = () => {
    setActiveStep(StepKey.Rules);
  };

  // Load rules preview content. Rule definitions (expr/labels/annotations) don't carry secrets,
  // unlike notifier configs, so this is shown as-is rather than run through redactPreviewSecrets.
  const handlePreviewRules = useCallback(() => {
    rulesPreview.show(async () => {
      if (hasYamlUpload(formData.rulesSource, formData.rulesYamlFile)) {
        return formData.rulesYamlFile.text();
      } else if (rulesToImport) {
        return JSON.stringify(rulesToImport, null, 2);
      }
      return '';
    }, formatPreviewError);
  }, [rulesPreview, formData.rulesSource, formData.rulesYamlFile, rulesToImport]);

  // Calculate rules count
  const rulesCount = useMemo(() => {
    if (!willImportRules || !rulesToImport) {
      return 0;
    }
    let count = 0;
    Object.values(rulesToImport).forEach((groups) => {
      groups.forEach((group) => {
        count += group.rules.length;
      });
    });
    return count;
  }, [willImportRules, rulesToImport]);

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
            disabled={nothingToImport || isLoadingRules}
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
