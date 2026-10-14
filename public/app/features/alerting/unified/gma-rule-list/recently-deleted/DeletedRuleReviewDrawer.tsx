import { type ReactNode, useEffect, useState } from 'react';

import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { CollapsableSection, Drawer, JSONFormatter, Stack, Text } from '@grafana/ui';
import { AnnoKeyFolder, AnnoKeyUpdatedBy } from 'app/features/apiserver/types';

import { useFolderPath } from '../folder-browsing/folderLookups';

import { trackDeletedRuleAdvancedJsonOpened, trackDeletedRuleReviewOpened } from './analytics';
import { sanitizeDeletedRule } from './sanitizeDeletedRule';
import { useDeletedByDisplayNames } from './useDeletedByDisplayNames';

export type DeletedRuleReviewDrawerProps =
  | { kind: 'alert'; rule: AlertRule; onClose: () => void }
  | { kind: 'recording'; rule: RecordingRule; onClose: () => void };

/** A labeled row in the human-readable preview; value can be blank while a lookup is pending. */
function ReviewField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack direction="column" gap={0.25}>
      <Text variant="bodySmall" color="secondary">
        {label}
      </Text>
      <Text>{value ?? ''}</Text>
    </Stack>
  );
}

function formatLabels(labels: Record<string, string> | undefined): string {
  if (!labels || Object.keys(labels).length === 0) {
    return '-';
  }
  return Object.entries(labels)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
}

export function DeletedRuleReviewDrawer(props: DeletedRuleReviewDrawerProps) {
  const { rule, onClose, kind } = props;
  const folderUid = rule.metadata.annotations?.[AnnoKeyFolder];
  const updatedBy = rule.metadata.annotations?.[AnnoKeyUpdatedBy];

  const folderPath = useFolderPath(folderUid)?.join(' / ');
  const { resolve: resolveDeletedBy } = useDeletedByDisplayNames([updatedBy]);
  const { settings: targetDataSourceSettings } = useDataSourceInstanceSettings(
    kind === 'recording' ? props.rule.spec.targetDatasourceUID : undefined
  );
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);

  useEffect(() => {
    trackDeletedRuleReviewOpened(kind);
    // Fire once, when the drawer is first opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deletedByDisplay = resolveDeletedBy(updatedBy) ?? updatedBy;
  const deletionTime = rule.metadata.deletionTimestamp;

  return (
    <Drawer
      title={rule.spec.title}
      subtitle={
        kind === 'alert'
          ? t('alerting.deleted-rules.review.subtitle-alert', 'Deleted alert rule')
          : t('alerting.deleted-rules.review.subtitle-recording', 'Deleted recording rule')
      }
      onClose={onClose}
      size="md"
    >
      <Stack direction="column" gap={2}>
        <ReviewField
          label={t('alerting.deleted-rules.review.folder', 'Folder')}
          value={folderPath ?? folderUid ?? t('alerting.deleted-rules.review.unknown', 'Unknown')}
        />
        <ReviewField
          label={t('alerting.deleted-rules.review.deleted', 'Deleted')}
          value={
            deletionTime
              ? `${dateTimeFormat(deletionTime)} (${dateTimeFormatTimeAgo(deletionTime)})`
              : t('alerting.deleted-rules.review.unknown', 'Unknown')
          }
        />
        <ReviewField
          label={t('alerting.deleted-rules.review.deleted-by', 'Deleted by')}
          value={deletedByDisplay ?? t('alerting.deleted-rules.review.unknown', 'Unknown')}
        />
        <ReviewField
          label={t('alerting.deleted-rules.review.paused', 'Paused')}
          value={rule.spec.paused ? t('common.yes', 'Yes') : t('common.no', 'No')}
        />
        <ReviewField
          label={t('alerting.deleted-rules.review.evaluation-interval', 'Evaluation interval')}
          value={rule.spec.trigger.interval}
        />
        {kind === 'recording' && (
          <>
            <ReviewField
              label={t('alerting.deleted-rules.review.recorded-metric', 'Recorded metric')}
              value={props.rule.spec.metric}
            />
            <ReviewField
              label={t('alerting.deleted-rules.review.target-data-source', 'Target data source')}
              value={targetDataSourceSettings?.name ?? props.rule.spec.targetDatasourceUID}
            />
          </>
        )}
        {kind === 'alert' && props.rule.spec.notificationSettings && (
          <ReviewField
            label={t('alerting.deleted-rules.review.notification-settings', 'Notification settings')}
            value={<Trans i18nKey="alerting.deleted-rules.review.notification-settings-present">Configured</Trans>}
          />
        )}
        {kind === 'alert' && props.rule.spec.panelRef && (
          <ReviewField
            label={t('alerting.deleted-rules.review.dashboard-panel', 'Dashboard panel')}
            value={`${props.rule.spec.panelRef.dashboardUID} / ${props.rule.spec.panelRef.panelID}`}
          />
        )}
        <ReviewField
          label={t('alerting.deleted-rules.review.labels', 'Labels')}
          value={formatLabels(rule.spec.labels)}
        />
        {kind === 'alert' && (
          <ReviewField
            label={t('alerting.deleted-rules.review.annotations', 'Annotations')}
            value={formatLabels(props.rule.spec.annotations)}
          />
        )}
        <ReviewField
          label={t('alerting.deleted-rules.review.expressions', 'Expressions and query definitions')}
          value={
            <pre>
              <code>{JSON.stringify(rule.spec.expressions, null, 2)}</code>
            </pre>
          }
        />

        <CollapsableSection
          label={t('alerting.deleted-rules.review.advanced-json', 'Advanced: Kubernetes JSON')}
          isOpen={showAdvancedJson}
          onToggle={(isOpen) => {
            setShowAdvancedJson(isOpen);
            if (isOpen) {
              trackDeletedRuleAdvancedJsonOpened(kind);
            }
          }}
        >
          <JSONFormatter json={sanitizeDeletedRule(rule)} open={2} />
        </CollapsableSection>
      </Stack>
    </Drawer>
  );
}
