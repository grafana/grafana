import { css, cx } from '@emotion/css';
import { useMemo, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Badge, Button, CollapsableSection, Select, Stack, Text, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';

import { type RuleFormValues } from '../../../types/rule-form';
import { ActionabilityProgressBar } from './ActionabilityProgressBar';
import { annotationsArrayToRecord } from './buildNotificationPreviewContent';
import { buildHumanNotificationDisplay, shouldShowRawTemplateOutput } from './buildHumanNotificationDisplay';
import { computeActionabilityScore } from './computeActionabilityScore';
import { getIntegrationAccentColor, getIntegrationBadgeLabel } from './getIntegrationAccentColor';
import { useContactPointTemplatePreview } from './useContactPointTemplatePreview';
import { useNotificationInstanceLabels } from './useNotificationInstanceLabels';
import {
  PolicyRoutedContactPointResolver,
  useManualContactPointName,
  useResolvedContactPoint,
} from './useSelectedContactPoint';

export function NotificationMessagePreview() {
  const styles = useStyles2(getStyles);
  const { control } = useFormContext<RuleFormValues>();
  const [integrationIndex, setIntegrationIndex] = useState(0);
  const [rawTemplateOpen, setRawTemplateOpen] = useState(false);

  const name = useWatch({ control, name: 'name' });
  const annotations = useWatch({ control, name: 'annotations' });
  const queries = useWatch({ control, name: 'queries' });
  const condition = useWatch({ control, name: 'condition' });
  const folder = useWatch({ control, name: 'folder' });
  const labels = useWatch({ control, name: 'labels' });
  const manualRouting = useWatch({ control, name: 'manualRouting' });

  const annotationRecord = useMemo(() => annotationsArrayToRecord(annotations ?? []), [annotations]);

  const { previewInstances, instanceLabels, isLoading: isLoadingLabels, canPreview, refreshRulePreview } =
    useNotificationInstanceLabels({
      name,
      queries: queries ?? [],
      condition,
      folder,
      labels: labels ?? [],
      annotations: annotations ?? [],
    });

  const manualContactPointName = useManualContactPointName();
  const [policyContactPointName, setPolicyContactPointName] = useState<string | undefined>();
  const [isResolvingPolicyContactPoint, setIsResolvingPolicyContactPoint] = useState(false);

  const contactPointName = manualContactPointName ?? policyContactPointName;
  const resolutionSource = manualContactPointName ? 'manual' : policyContactPointName ? 'policy' : undefined;
  const { contactPoint, isLoading: isLoadingContactPoint } = useResolvedContactPoint(contactPointName);

  const displayLabels = useMemo(() => {
    const formLabels = Object.fromEntries(
      (labels ?? []).filter(({ key, value }) => Boolean(key?.trim()) && Boolean(value?.trim())).map(({ key, value }) => [key, value])
    );
    const merged = { ...formLabels, ...instanceLabels };
    if (!merged.alertname && name?.trim()) {
      merged.alertname = name.trim();
    }
    return merged;
  }, [instanceLabels, labels, name]);

  const labelEntries = useMemo(() => Object.entries(displayLabels).slice(0, 3), [displayLabels]);

  const integrations = contactPoint?.spec.integrations ?? [];
  const selectedIntegrationIndex = Math.min(integrationIndex, Math.max(integrations.length - 1, 0));

  const {
    title: renderedTitle,
    body: renderedBody,
    integrationType,
    integrationLabel,
    previewMayDifferFromDelivery,
    templateErrors,
    error: previewError,
    isLoading: isRenderingTemplate,
    refreshPreview,
    canRefreshPreview,
  } = useContactPointTemplatePreview({
    contactPoint,
    integrationIndex: selectedIntegrationIndex,
    ruleName: name ?? '',
    annotations: annotationRecord,
    labels: displayLabels,
    previewInstances,
  });

  const resolvedAnnotations = useMemo(() => {
    const fromPreview = previewInstances?.find((instance) => instance.annotations)?.annotations ?? {};
    return {
      ...annotationRecord,
      ...fromPreview,
    };
  }, [annotationRecord, previewInstances]);

  const humanDisplay = useMemo(
    () =>
      buildHumanNotificationDisplay({
        ruleName: name ?? '',
        annotations: resolvedAnnotations,
        renderedTitle,
      }),
    [name, resolvedAnnotations, renderedTitle]
  );

  const showRawTemplate = shouldShowRawTemplateOutput(renderedBody, humanDisplay);
  const integrationBadgeLabel = getIntegrationBadgeLabel(integrationType, integrationLabel);
  const accentColor = styles.getAccentColor(integrationType);

  const actionability = computeActionabilityScore({
    annotations: resolvedAnnotations,
    labelCount: (labels ?? []).filter(({ key, value }) => Boolean(key?.trim()) && Boolean(value?.trim())).length,
  });

  const integrationOptions = integrations.map((integration, index) => ({
    label: integration.type,
    value: index,
  }));

  const isLoading = isLoadingContactPoint || isResolvingPolicyContactPoint || isRenderingTemplate;

  const subtitle = useMemo(() => {
    if (!contactPointName) {
      return t(
        'alerting.notification-message-preview.no-contact-point-short',
        'Select a contact point to preview its message template.'
      );
    }

    const parts = [contactPointName];
    if (integrationType) {
      parts.push(
        resolutionSource === 'policy'
          ? t('alerting.notification-message-preview.via-policy-short', 'via policy → {{type}}', {
              type: integrationType,
            })
          : integrationType
      );
    }
    return parts.join(' · ');
  }, [contactPointName, integrationType, resolutionSource]);

  const handleRefresh = () => {
    refreshRulePreview();
    refreshPreview();
  };

  return (
    <div className={styles.container} data-testid="notification-message-preview">
      {!manualRouting ? (
        <PolicyRoutedContactPointResolver
          instanceLabels={instanceLabels}
          onResolved={(name, loading) => {
            setPolicyContactPointName(name);
            setIsResolvingPolicyContactPoint(loading);
          }}
        />
      ) : null}

      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
        <Stack direction="column" gap={0.5} grow={1}>
          <Text variant="h6">
            <Trans i18nKey="alerting.notification-message-preview.title">Notification preview</Trans>
          </Text>
          <Text variant="bodySmall" color="secondary">
            {subtitle}
          </Text>
        </Stack>
        {canRefreshPreview ? (
          <Tooltip content={t('alerting.notification-message-preview.refresh', 'Refresh preview')}>
            <Button
              icon="sync"
              variant="secondary"
              size="sm"
              fill="text"
              type="button"
              disabled={isRenderingTemplate || isLoadingLabels}
              onClick={handleRefresh}
              aria-label={t('alerting.notification-message-preview.refresh-aria-label', 'Refresh notification preview')}
            />
          </Tooltip>
        ) : null}
      </Stack>

      {contactPointName && integrations.length > 1 ? (
        <Select
          options={integrationOptions}
          value={selectedIntegrationIndex}
          onChange={(option) => setIntegrationIndex(option?.value ?? 0)}
          width={30}
          aria-label={t('alerting.notification-message-preview.integration-label', 'Integration')}
        />
      ) : null}

      {previewMayDifferFromDelivery ? (
        <Text variant="bodySmall" color="secondary">
          {t(
            'alerting.notification-message-preview.approximate-description-short',
            'Final formatting may differ for {{integration}} based on contact point settings.',
            { integration: integrationLabel ?? integrationType ?? 'this integration' }
          )}
        </Text>
      ) : null}

      {previewError ? (
        <Alert severity="warning" title={t('alerting.notification-message-preview.render-error', 'Could not render template')}>
          {stringifyErrorLike(previewError)}
        </Alert>
      ) : null}

      {templateErrors?.map((templateError) => (
        <Alert
          key={`${templateError.name}-${templateError.kind}`}
          severity="warning"
          title={templateError.name || t('alerting.notification-message-preview.template-error', 'Template error')}
        >
          {templateError.message}
        </Alert>
      ))}

      <div className={styles.layout}>
        <Stack direction="column" gap={1.5} className={styles.metaColumn}>
          {!canPreview ? (
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="alerting.notification-message-preview.query-hint">
                Add a query, condition, and folder to include real instance labels and values in the preview.
              </Trans>
            </Text>
          ) : null}

          <ActionabilityProgressBar actionability={actionability} />

          {canPreview && isLoadingLabels ? (
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="alerting.notification-message-preview.loading-labels">Loading sample instance labels…</Trans>
            </Text>
          ) : null}

          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="alerting.notification-message-preview.auto-refresh-hint">
              Updates when you refresh or change the contact point.
            </Trans>
          </Text>
        </Stack>

        <Stack direction="column" gap={1} className={styles.previewColumn}>
          <Text variant="bodySmall" color="secondary" weight="medium">
            <Trans i18nKey="alerting.notification-message-preview.on-call-label">On-call preview</Trans>
          </Text>

          {!contactPointName ? (
            <div className={styles.emptyState} data-testid="notification-message-preview-empty">
              <Text variant="body" color="secondary">
                <Trans i18nKey="alerting.notification-message-preview.empty-state">
                  Select a contact point to see what on-call receives.
                </Trans>
              </Text>
            </div>
          ) : (
            <>
              <div
                className={styles.previewFrame}
                aria-label={t('alerting.notification-message-preview.phone-label', 'Notification preview')}
              >
                <div className={styles.notificationCard(accentColor)}>
                  {isLoading ? (
                    <NotificationPreviewSkeleton />
                  ) : (
                    <>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" wrap="wrap" gap={0.5}>
                        <Stack direction="row" gap={0.5} alignItems="center" wrap="wrap">
                          <Badge color="blue" text={integrationBadgeLabel} />
                          <Text variant="bodySmall" color="secondary">
                            {contactPointName}
                          </Text>
                        </Stack>
                        <Badge color="red" text={t('alerting.notification-message-preview.firing-badge', 'FIRING')} />
                      </Stack>

                      <Text variant="h6" color="primary" className={styles.notificationTitle}>
                        {humanDisplay.title}
                      </Text>

                      <Text variant="body" color="primary" className={styles.notificationBody}>
                        {humanDisplay.body}
                      </Text>

                      {humanDisplay.secondary ? (
                        <Text variant="bodySmall" color="secondary" className={styles.secondaryLine}>
                          {humanDisplay.secondary}
                        </Text>
                      ) : null}

                      {labelEntries.length > 0 ? (
                        <Stack direction="row" gap={0.5} wrap="wrap" className={styles.labelRow}>
                          {labelEntries.map(([key, value]) => (
                            <span key={key} className={styles.labelChip}>
                              <span className={styles.labelKey}>{key}:</span>{' '}
                              <span className={styles.labelValue}>{value}</span>
                            </span>
                          ))}
                        </Stack>
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              {showRawTemplate && renderedBody?.trim() ? (
                <CollapsableSection
                  label={t('alerting.notification-message-preview.raw-template-label', 'Raw template output')}
                  isOpen={rawTemplateOpen}
                  onToggle={setRawTemplateOpen}
                  contentDataTestId="notification-message-preview-raw"
                >
                  <pre className={styles.rawTemplate}>{renderedBody.trim()}</pre>
                </CollapsableSection>
              ) : null}
            </>
          )}
        </Stack>
      </div>
    </div>
  );
}

function NotificationPreviewSkeleton() {
  const styles = useStyles2(getSkeletonStyles);

  return (
    <Stack direction="column" gap={1} data-testid="notification-message-preview-skeleton">
      <div className={cx(styles.line, styles.lineShort)} />
      <div className={styles.line} />
      <div className={styles.line} />
      <div className={cx(styles.line, styles.lineMedium)} />
    </Stack>
  );
}

const getSkeletonStyles = (theme: GrafanaTheme2) => ({
  line: css({
    height: theme.spacing(1.5),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.emphasize(theme.colors.background.secondary, 0.05),
    animation: 'notification-preview-pulse 1.4s ease-in-out infinite',
    '@keyframes notification-preview-pulse': {
      '0%, 100%': { opacity: 0.45 },
      '50%': { opacity: 0.85 },
    },
  }),
  lineShort: css({
    width: '40%',
  }),
  lineMedium: css({
    width: '70%',
  }),
});

const getStyles = (theme: GrafanaTheme2) => ({
  getAccentColor: (integrationType: string | undefined) => getIntegrationAccentColor(integrationType, theme),
  container: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(2),
    background: theme.colors.background.secondary,
    gap: theme.spacing(1.5),
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    width: '100%',
  }),
  layout: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    [`@media (min-width: ${theme.breakpoints.values.md}px)`]: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
  }),
  metaColumn: css({
    flex: '1 1 240px',
    minWidth: 0,
  }),
  previewColumn: css({
    flex: '1 1 320px',
    minWidth: 0,
    maxWidth: '100%',
    [`@media (min-width: ${theme.breakpoints.values.md}px)`]: {
      maxWidth: '480px',
    },
  }),
  previewFrame: css({
    background: theme.colors.background.canvas,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(1.5),
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  emptyState: css({
    border: `1px dashed ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(3),
    background: theme.colors.background.primary,
    textAlign: 'center',
  }),
  notificationCard: (accentColor: string) =>
    css({
      background: theme.colors.background.primary,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1.5),
      boxShadow: theme.shadows.z1,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.75),
      minWidth: 0,
      maxHeight: '320px',
      overflowY: 'auto',
      overflowX: 'hidden',
      borderLeft: `4px solid ${accentColor}`,
    }),
  notificationTitle: css({
    lineHeight: 1.3,
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
  }),
  notificationBody: css({
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-wrap',
  }),
  secondaryLine: css({
    lineHeight: 1.4,
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-wrap',
  }),
  labelRow: css({
    marginTop: theme.spacing(0.5),
  }),
  labelChip: css({
    fontSize: theme.typography.bodySmall.fontSize,
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.pill,
    padding: `${theme.spacing(0.25)} ${theme.spacing(0.75)}`,
    wordBreak: 'break-all',
    maxWidth: '100%',
  }),
  labelKey: css({
    color: theme.colors.text.secondary,
  }),
  labelValue: css({
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  rawTemplate: css({
    margin: 0,
    padding: theme.spacing(1),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    maxHeight: '240px',
    overflowY: 'auto',
  }),
});
