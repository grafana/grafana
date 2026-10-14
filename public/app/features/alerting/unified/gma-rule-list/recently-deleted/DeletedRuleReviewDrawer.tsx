import { useEffect, useState } from 'react';

import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { CollapsableSection, Drawer, JSONFormatter, Stack } from '@grafana/ui';
import { AnnoKeyFolder, AnnoKeyUpdatedBy } from 'app/features/apiserver/types';

import { useFolderPath } from '../folder-browsing/folderLookups';
import { FolderPath } from '../rule-row/FolderPath';

import { DeletedRuleDashboardReference } from './DeletedRuleDashboardReference';
import { DeletedRuleExpressions } from './DeletedRuleExpressions';
import { DeletedRuleNotificationSettings } from './DeletedRuleNotificationSettings';
import { DeletedRuleReviewField as ReviewField } from './DeletedRuleReviewField';
import { trackDeletedRuleAdvancedJsonOpened, trackDeletedRuleReviewOpened } from './analytics';
import { sanitizeDeletedRule } from './sanitizeDeletedRule';
import { useDeletedByDisplayNames } from './useDeletedByDisplayNames';

export type DeletedRuleReviewDrawerProps =
  | { kind: 'alert'; rule: AlertRule; onClose: () => void }
  | { kind: 'recording'; rule: RecordingRule; onClose: () => void };

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

  const folderPath = useFolderPath(folderUid);
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
          value={
            folderPath && folderPath.length > 0 ? (
              <FolderPath segments={folderPath} />
            ) : (
              (folderUid ?? t('alerting.deleted-rules.review.unknown', 'Unknown'))
            )
          }
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
          <DeletedRuleNotificationSettings settings={props.rule.spec.notificationSettings} />
        )}
        {kind === 'alert' && props.rule.spec.panelRef && (
          <DeletedRuleDashboardReference
            dashboardUid={props.rule.spec.panelRef.dashboardUID}
            panelId={props.rule.spec.panelRef.panelID}
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
          value={<DeletedRuleExpressions expressions={rule.spec.expressions} />}
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
