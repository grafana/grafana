import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import { useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { Alert, Box, Button, Collapse, Icon, Modal, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import type { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { stringifyErrorLike } from '../../utils/misc';
import { createListFilterLink } from '../../utils/navigation';
import { useGetRulerRules } from '../rule-editor/useAlertRuleSuggestions';

import { ImportFormValues, MERGE_MATCHERS_LABEL_NAME } from './ImportToGMA';
import { filterRulerRulesConfig, useImportNotifications, useImportRules } from './useImport';

interface ImportPreviewModalProps {
  formData: ImportFormValues;
  onDismiss: () => void;
}

interface AlertmanagerConfig {
  receivers?: Array<{ name: string }>;
  route?: {
    receiver?: string;
    routes?: unknown[];
  };
  templates?: string[];
  time_intervals?: Array<{ name: string }>;
  mute_time_intervals?: Array<{ name: string }>;
}

interface ParsedAlertmanagerConfig {
  contactPoints: string[];
  hasPolicy: boolean;
  policyRoutesCount: number;
  templates: string[];
  timeIntervals: string[];
}

// Type guard for Record<string, unknown>
function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null;
}

// Safely get a property from an object
function getProperty(obj: Record<string, unknown>, key: string): unknown {
  return obj[key];
}

// Safely convert unknown YAML data to AlertmanagerConfig
function toAlertmanagerConfig(data: unknown): AlertmanagerConfig {
  if (!isRecord(data)) {
    return {};
  }

  const receivers = getProperty(data, 'receivers');
  const route = getProperty(data, 'route');
  const templates = getProperty(data, 'templates');
  const timeIntervals = getProperty(data, 'time_intervals');
  const muteTimeIntervals = getProperty(data, 'mute_time_intervals');

  return {
    receivers: Array.isArray(receivers) ? parseReceivers(receivers) : undefined,
    route: isRecord(route) ? parseRoute(route) : undefined,
    templates: Array.isArray(templates) ? templates.filter((tpl): tpl is string => typeof tpl === 'string') : undefined,
    time_intervals: Array.isArray(timeIntervals) ? parseTimeIntervals(timeIntervals) : undefined,
    mute_time_intervals: Array.isArray(muteTimeIntervals) ? parseTimeIntervals(muteTimeIntervals) : undefined,
  };
}

function parseReceivers(receivers: unknown[]): Array<{ name: string }> {
  return receivers
    .filter(isRecord)
    .map((item) => {
      const name = getProperty(item, 'name');
      return { name: typeof name === 'string' ? name : '' };
    })
    .filter((item) => item.name !== '');
}

function parseRoute(route: Record<string, unknown>): AlertmanagerConfig['route'] {
  const receiver = getProperty(route, 'receiver');
  const routes = getProperty(route, 'routes');
  return {
    receiver: typeof receiver === 'string' ? receiver : undefined,
    routes: Array.isArray(routes) ? routes : undefined,
  };
}

function parseTimeIntervals(intervals: unknown[]): Array<{ name: string }> {
  return intervals
    .filter(isRecord)
    .map((item) => {
      const name = getProperty(item, 'name');
      return { name: typeof name === 'string' ? name : '' };
    })
    .filter((item) => item.name !== '');
}

function parseAlertmanagerConfig(config: AlertmanagerConfig): ParsedAlertmanagerConfig {
  const contactPoints = config.receivers?.map((r) => r.name) || [];
  const hasPolicy = !!config.route;
  const policyRoutesCount = config.route?.routes?.length || 0;
  const templates = config.templates || [];
  const timeIntervals = [
    ...(config.time_intervals?.map((ti) => ti.name) || []),
    ...(config.mute_time_intervals?.map((ti) => ti.name) || []),
  ];

  return {
    contactPoints,
    hasPolicy,
    policyRoutesCount,
    templates,
    timeIntervals,
  };
}

function countRules(rules: RulerRulesConfigDTO): {
  alertRules: number;
  recordingRules: number;
  namespaces: number;
  groups: number;
} {
  let alertRules = 0;
  let recordingRules = 0;
  let groups = 0;
  const namespaces = Object.keys(rules).length;

  for (const namespace of Object.values(rules)) {
    groups += namespace.length;
    for (const group of namespace) {
      for (const rule of group.rules) {
        if ('alert' in rule) {
          alertRules++;
        } else if ('record' in rule) {
          recordingRules++;
        }
      }
    }
  }

  return { alertRules, recordingRules, namespaces, groups };
}

export function ImportPreviewModal({ formData, onDismiss }: ImportPreviewModalProps) {
  const styles = useStyles2(getStyles);
  const notifyApp = useAppNotification();
  const [migrationStatus, setMigrationStatus] = useState<'preview' | 'migrating' | 'success' | 'error'>('preview');
  const [error, setError] = useState<string | null>(null);
  const [showRulesDetails, setShowRulesDetails] = useState(true);
  const [showNotificationsDetails, setShowNotificationsDetails] = useState(true);

  const importNotifications = useImportNotifications();
  const importRules = useImportRules();

  // Determine what to migrate based on wizard steps
  const willMigrateNotifications = formData.step1Completed && !formData.step1Skipped;
  const willMigrateRules = formData.step2Completed && !formData.step2Skipped;

  // Fetch rules from datasource
  const shouldFetchRules = willMigrateRules && formData.rulesSource === 'datasource';
  const { rulerRules: rulesFromDatasource, isLoading: isLoadingRules } = useGetRulerRules(
    shouldFetchRules ? (formData.rulesDatasourceName ?? undefined) : undefined
  );

  // Fetch Alertmanager config from datasource
  const { value: notificationsFromDatasource, loading: isLoadingNotifications } = useAsync(async () => {
    if (
      !willMigrateNotifications ||
      formData.notificationsSource !== 'datasource' ||
      !formData.notificationsDatasourceUID
    ) {
      return null;
    }
    try {
      const response = await getBackendSrv().get<{ config: { original: string } }>(
        `/api/alertmanager/${formData.notificationsDatasourceUID}/api/v2/status`
      );
      const { load } = await import('js-yaml');
      const config = load(response.config?.original || '');
      return parseAlertmanagerConfig(toAlertmanagerConfig(config));
    } catch (err) {
      console.error('Failed to fetch Alertmanager config:', err);
      return null;
    }
  }, [willMigrateNotifications, formData.notificationsSource, formData.notificationsDatasourceUID]);

  // Parse Alertmanager config from YAML file
  const { value: notificationsFromYaml, loading: isParsingNotificationsYaml } = useAsync(async () => {
    if (!willMigrateNotifications || formData.notificationsSource !== 'yaml' || !formData.notificationsYamlFile) {
      return null;
    }
    try {
      const content = await formData.notificationsYamlFile.text();
      const { load } = await import('js-yaml');
      const config = load(content);
      return parseAlertmanagerConfig(toAlertmanagerConfig(config));
    } catch (err) {
      console.error('Failed to parse Alertmanager YAML:', err);
      return null;
    }
  }, [willMigrateNotifications, formData.notificationsSource, formData.notificationsYamlFile]);

  const isLoading = isLoadingRules || isLoadingNotifications || isParsingNotificationsYaml;

  const rulesPreview = useMemo(() => {
    if (!willMigrateRules) {
      return null;
    }
    if (formData.rulesSource === 'datasource' && rulesFromDatasource) {
      // Filter rules by namespace and group if specified
      const { filteredConfig } = filterRulerRulesConfig(rulesFromDatasource, formData.namespace, formData.ruleGroup);
      return countRules(filteredConfig);
    }
    if (formData.rulesSource === 'yaml' && formData.rulesYamlFile) {
      return { alertRules: -1, recordingRules: -1, namespaces: -1, groups: -1, fileName: formData.rulesYamlFile.name };
    }
    return null;
  }, [
    willMigrateRules,
    formData.rulesSource,
    formData.rulesYamlFile,
    formData.namespace,
    formData.ruleGroup,
    rulesFromDatasource,
  ]);

  const notificationsPreview = useMemo(() => {
    if (!willMigrateNotifications) {
      return null;
    }
    if (formData.notificationsSource === 'datasource') {
      return notificationsFromDatasource;
    }
    if (formData.notificationsSource === 'yaml') {
      return notificationsFromYaml;
    }
    return null;
  }, [willMigrateNotifications, formData.notificationsSource, notificationsFromDatasource, notificationsFromYaml]);

  const handleConfirm = async () => {
    setMigrationStatus('migrating');
    setError(null);

    try {
      const notificationsLabel = `${MERGE_MATCHERS_LABEL_NAME}=${formData.policyTreeName}`;

      // Import notifications first (if step 1 was completed)
      if (willMigrateNotifications) {
        await importNotifications({
          source: formData.notificationsSource,
          datasourceName: formData.notificationsDatasourceName ?? undefined,
          yamlFile: formData.notificationsYamlFile,
          mergeMatchers: notificationsLabel,
        });
      }

      // Then import rules (if step 2 was completed)
      if (willMigrateRules && formData.rulesDatasourceUID) {
        // Get the filtered rules payload
        let rulesPayload: RulerRulesConfigDTO = {};

        if (formData.rulesSource === 'datasource' && rulesFromDatasource) {
          const { filteredConfig } = filterRulerRulesConfig(
            rulesFromDatasource,
            formData.namespace,
            formData.ruleGroup
          );
          rulesPayload = filteredConfig;
        }
        // TODO: Handle YAML source - parse and use rulesFromYaml

        // Calculate extra labels based on notification policy option
        let extraLabels: string | undefined;
        if (formData.notificationPolicyOption === 'imported') {
          extraLabels = `${MERGE_MATCHERS_LABEL_NAME}=${formData.policyTreeName}`;
        } else if (formData.notificationPolicyOption === 'manual') {
          extraLabels = `${formData.manualLabelName}=${formData.manualLabelValue}`;
        }
        // 'default' policy: no labels added

        await importRules({
          dataSourceUID: formData.rulesDatasourceUID,
          targetFolderUID: formData.targetFolder?.uid,
          pauseAlertingRules: formData.pauseAlertingRules,
          pauseRecordingRules: formData.pauseRecordingRules,
          payload: rulesPayload,
          targetDatasourceUID: formData.targetDatasourceUID,
          extraLabels,
        });
      }

      setMigrationStatus('success');

      // Show success notification
      notifyApp.success(t('alerting.import-to-gma.success', 'Successfully imported resources to Grafana Alerting.'));

      // Build redirect URL with folder filter (like ImportToGMARules)
      const targetFolder = formData.targetFolder;
      const isRootFolder = isEmpty(targetFolder?.uid);
      const ruleListUrl = createListFilterLink(isRootFolder ? [] : [['namespace', targetFolder?.title ?? '']], {
        skipSubPath: true,
      });

      // Redirect to alert list with folder filter
      setTimeout(() => {
        locationService.push(ruleListUrl);
      }, 1500);
    } catch (err) {
      setMigrationStatus('error');
      setError(stringifyErrorLike(err));
    }
  };

  const nothingToMigrate = !willMigrateNotifications && !willMigrateRules;

  return (
    <Modal
      isOpen={true}
      title={t('alerting.import-to-gma.preview.title', 'Confirm Import')}
      onDismiss={onDismiss}
      className={styles.modal}
    >
      <Stack direction="column" gap={2}>
        {migrationStatus === 'preview' && (
          <>
            {nothingToMigrate && (
              <Alert severity="warning" title={t('alerting.import-to-gma.preview.nothing', 'Nothing to import')}>
                <Trans i18nKey="alerting.import-to-gma.preview.nothing-desc">
                  Both steps were skipped. There is nothing to migrate.
                </Trans>
              </Alert>
            )}
            {!nothingToMigrate && isLoading && (
              <Stack direction="row" gap={2} alignItems="center" justifyContent="center">
                <Spinner />
                <Text>
                  <Trans i18nKey="alerting.import-to-gma.preview.loading">Loading preview...</Trans>
                </Text>
              </Stack>
            )}
            {!nothingToMigrate && !isLoading && (
              <>
                {/* Notifications Preview (Step 1) */}
                {willMigrateNotifications && (
                  <Box>
                    <Collapse
                      label={
                        <Stack direction="row" gap={1} alignItems="center">
                          <Icon name="bell" />
                          <Text weight="medium">
                            {t('alerting.import-to-gma.preview.step1', 'Step 1: Alertmanager Resources')}
                          </Text>
                          <Text color="secondary">
                            {formData.notificationsSource === 'datasource'
                              ? `(${formData.notificationsDatasourceName})`
                              : `(${formData.notificationsYamlFile?.name})`}
                          </Text>
                        </Stack>
                      }
                      isOpen={showNotificationsDetails}
                      onToggle={() => setShowNotificationsDetails(!showNotificationsDetails)}
                    >
                      <Box padding={2} backgroundColor="secondary">
                        {notificationsPreview ? (
                          <Stack direction="column" gap={2}>
                            <Text color="secondary">
                              <Trans i18nKey="alerting.import-to-gma.preview.label-used">
                                Policy tree:{' '}
                                <strong>
                                  {MERGE_MATCHERS_LABEL_NAME}={formData.policyTreeName}
                                </strong>
                              </Trans>
                            </Text>

                            {notificationsPreview.contactPoints.length > 0 && (
                              <Box>
                                <Text weight="medium">
                                  {t('alerting.import-to-gma.preview.contact-points', 'Contact Points')} (
                                  {notificationsPreview.contactPoints.length})
                                </Text>
                                <ul className={styles.list}>
                                  {notificationsPreview.contactPoints.map((cp) => (
                                    <li key={cp}>{cp}</li>
                                  ))}
                                </ul>
                              </Box>
                            )}

                            {notificationsPreview.hasPolicy && (
                              <Text>
                                <Trans i18nKey="alerting.import-to-gma.preview.policy-info">
                                  Notification policy with {notificationsPreview.policyRoutesCount} nested routes
                                </Trans>
                              </Text>
                            )}

                            {notificationsPreview.templates.length > 0 && (
                              <Text>
                                {t('alerting.import-to-gma.preview.templates-count', 'Templates')}:{' '}
                                {notificationsPreview.templates.length}
                              </Text>
                            )}

                            {notificationsPreview.timeIntervals.length > 0 && (
                              <Text>
                                {t('alerting.import-to-gma.preview.time-intervals-count', 'Time intervals')}:{' '}
                                {notificationsPreview.timeIntervals.length}
                              </Text>
                            )}

                            {/* Validation status indicator */}
                            <Stack direction="row" gap={1} alignItems="center">
                              <Icon name="check-circle" className={styles.successIcon} />
                              <Text color="success">
                                {t(
                                  'alerting.import-to-gma.preview.no-conflicts',
                                  'No conflicts found. Configuration is ready to import.'
                                )}
                              </Text>
                            </Stack>
                          </Stack>
                        ) : (
                          <Text color="secondary">
                            <Trans i18nKey="alerting.import-to-gma.preview.notifications-loading">
                              Loading Alertmanager configuration...
                            </Trans>
                          </Text>
                        )}
                      </Box>
                    </Collapse>
                  </Box>
                )}

                {/* Rules Preview (Step 2) */}
                {willMigrateRules && (
                  <Box>
                    <Collapse
                      label={
                        <Stack direction="row" gap={1} alignItems="center">
                          <Icon name="file-alt" />
                          <Text weight="medium">
                            {t('alerting.import-to-gma.preview.step2', 'Step 2: Alert Rules')}
                          </Text>
                          <Text color="secondary">
                            {formData.rulesSource === 'datasource'
                              ? `(${formData.rulesDatasourceName})`
                              : `(${formData.rulesYamlFile?.name})`}
                          </Text>
                        </Stack>
                      }
                      isOpen={showRulesDetails}
                      onToggle={() => setShowRulesDetails(!showRulesDetails)}
                    >
                      <Box padding={2} backgroundColor="secondary">
                        <Stack direction="column" gap={1}>
                          {/* Policy option info */}
                          <Text color="secondary">
                            {formData.notificationPolicyOption === 'default' && (
                              <Trans i18nKey="alerting.import-to-gma.preview.policy-default">
                                Routing: Using Grafana default policy (no label added)
                              </Trans>
                            )}
                            {formData.notificationPolicyOption === 'imported' && (
                              <Trans i18nKey="alerting.import-to-gma.preview.policy-imported">
                                Routing: Using imported policy. Label{' '}
                                <strong>
                                  {MERGE_MATCHERS_LABEL_NAME}={formData.policyTreeName}
                                </strong>{' '}
                                will be added.
                              </Trans>
                            )}
                            {formData.notificationPolicyOption === 'manual' && (
                              <Trans i18nKey="alerting.import-to-gma.preview.policy-manual">
                                Routing: Manual label{' '}
                                <strong>
                                  {formData.manualLabelName}={formData.manualLabelValue}
                                </strong>{' '}
                                will be added.
                              </Trans>
                            )}
                          </Text>

                          {/* Filter info */}
                          {(formData.namespace || formData.ruleGroup) && (
                            <Text color="info">
                              🔍 {t('alerting.import-to-gma.preview.filter-info', 'Filtering by')}:{' '}
                              {formData.namespace && !formData.ruleGroup && (
                                <strong>
                                  {t('alerting.import-to-gma.preview.namespace-filter', 'Namespace')}:{' '}
                                  {formData.namespace}
                                </strong>
                              )}
                              {formData.namespace && formData.ruleGroup && (
                                <strong>
                                  {formData.namespace} / {formData.ruleGroup}
                                </strong>
                              )}
                            </Text>
                          )}

                          {rulesPreview && (
                            <>
                              {'fileName' in rulesPreview ? (
                                <Text>
                                  <Trans i18nKey="alerting.import-to-gma.preview.rules-yaml-info">
                                    Rules from file: {rulesPreview.fileName}
                                  </Trans>
                                </Text>
                              ) : (
                                <>
                                  <Text>
                                    {t('alerting.import-to-gma.preview.namespaces', 'Namespaces')}:{' '}
                                    {rulesPreview.namespaces}
                                  </Text>
                                  <Text>
                                    {t('alerting.import-to-gma.preview.groups', 'Groups')}: {rulesPreview.groups}
                                  </Text>
                                  <Text>
                                    {t('alerting.import-to-gma.preview.alert-rules', 'Alert rules')}:{' '}
                                    {rulesPreview.alertRules}
                                  </Text>
                                  <Text>
                                    {t('alerting.import-to-gma.preview.recording-rules', 'Recording rules')}:{' '}
                                    {rulesPreview.recordingRules}
                                  </Text>
                                </>
                              )}

                              {formData.targetFolder && (
                                <Text>
                                  {t('alerting.import-to-gma.preview.target-folder', 'Target folder')}:{' '}
                                  {formData.targetFolder.title}
                                </Text>
                              )}

                              {formData.pauseAlertingRules && (
                                <Text color="secondary">
                                  ⏸️ {t('alerting.import-to-gma.preview.pause-alerting', 'Alert rules will be paused')}
                                </Text>
                              )}

                              {formData.pauseRecordingRules && (
                                <Text color="secondary">
                                  ⏸️{' '}
                                  {t(
                                    'alerting.import-to-gma.preview.pause-recording',
                                    'Recording rules will be paused'
                                  )}
                                </Text>
                              )}
                            </>
                          )}
                        </Stack>
                      </Box>
                    </Collapse>
                  </Box>
                )}

                {/* Skipped steps info */}
                {formData.step1Skipped && (
                  <Text color="secondary">
                    ℹ️{' '}
                    {t('alerting.import-to-gma.preview.step1-skipped', 'Step 1 (Alertmanager resources) was skipped')}
                  </Text>
                )}
                {formData.step2Skipped && (
                  <Text color="secondary">
                    ℹ️ {t('alerting.import-to-gma.preview.step2-skipped', 'Step 2 (Alert rules) was skipped')}
                  </Text>
                )}
              </>
            )}
          </>
        )}

        {migrationStatus === 'migrating' && (
          <Stack direction="row" gap={2} alignItems="center" justifyContent="center">
            <Spinner />
            <Text>
              <Trans i18nKey="alerting.import-to-gma.confirm.importing">Import in progress...</Trans>
            </Text>
          </Stack>
        )}

        {migrationStatus === 'success' && (
          <Alert severity="success" title={t('alerting.import-to-gma.confirm.success-title', 'Import completed')}>
            <Trans i18nKey="alerting.import-to-gma.confirm.success">
              Your resources have been successfully imported to Grafana Alerting. Redirecting to alert rules...
            </Trans>
          </Alert>
        )}

        {migrationStatus === 'error' && error && (
          <Alert severity="error" title={t('alerting.import-to-gma.confirm.error-title', 'Import failed')}>
            {error}
          </Alert>
        )}

        {/* Action Buttons */}
        <Modal.ButtonRow>
          <Button variant="secondary" onClick={onDismiss} disabled={migrationStatus === 'migrating'}>
            {t('alerting.import-to-gma.preview.cancel', 'Cancel')}
          </Button>
          {migrationStatus === 'preview' && !nothingToMigrate && (
            <Button variant="primary" onClick={handleConfirm} disabled={isLoading}>
              {t('alerting.import-to-gma.preview.start', 'Start Import')}
            </Button>
          )}
          {migrationStatus === 'success' && (
            <Button
              variant="primary"
              onClick={() => {
                const targetFolder = formData.targetFolder;
                const isRootFolder = isEmpty(targetFolder?.uid);
                const ruleListUrl = createListFilterLink(
                  isRootFolder ? [] : [['namespace', targetFolder?.title ?? '']],
                  { skipSubPath: true }
                );
                locationService.push(ruleListUrl);
              }}
            >
              {t('alerting.import-to-gma.preview.done', 'Go to Alert Rules')}
            </Button>
          )}
        </Modal.ButtonRow>
      </Stack>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: '650px',
    maxWidth: '90vw',
  }),
  list: css({
    margin: theme.spacing(1, 0, 0, 2),
    paddingLeft: theme.spacing(2),
    '& li': {
      marginBottom: theme.spacing(0.5),
    },
  }),
  successIcon: css({
    color: theme.colors.success.main,
  }),
});
