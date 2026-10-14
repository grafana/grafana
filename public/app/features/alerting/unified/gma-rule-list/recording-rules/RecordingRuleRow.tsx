import { type ReactNode } from 'react';

import { t } from '@grafana/i18n';
import { Stack, Text, TextLink, Tooltip } from '@grafana/ui';

import { getDataSourceByUid } from '../../utils/datasource';
import { GRAFANA_ORIGIN_LABEL } from '../../utils/labels';
import { useFolderPath } from '../folder-browsing/folderLookups';
import { getManagerKind, getPluginId, isProvisionedOrManaged } from '../rule-data/ruleOwnership';
import { useFullRecordingRuleState } from '../rule-data/ruleResourceLookups';
import { DataSourcesMeta } from '../rule-row/DataSourcesMeta';
import { FolderPath } from '../rule-row/FolderPath';
import { IntervalIndicator } from '../rule-row/IntervalIndicator';
import { LabelsMeta } from '../rule-row/LabelsMeta';
import { PluginOriginBadge } from '../rule-row/PluginOriginBadge';
import { ProvisioningBadge } from '../rule-row/ProvisioningBadge';
import { RuleListItem } from '../rule-row/RuleListItem';
import { RuleStatusIcon } from '../rule-row/RuleStatusIcon';

import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

interface RecordingRuleRowProps {
  hit: RecordingRuleSearchHit;
  /** Folder path is shown in List mode only - Folders mode already shows it on the folder row. */
  showFolderPath: boolean;
  actions?: ReactNode;
}

/**
 * GMA-only Recording rule row for both Folders and List mode. Presentation-only, same
 * lookups as AlertRuleRow. No alert state, instances, notification routing,
 * summary, Silence, or Declare-incident information - Recording rules have none of those.
 */
export function RecordingRuleRow({ hit, showFolderPath, actions }: RecordingRuleRowProps) {
  const fullRule = useFullRecordingRuleState(hit.uid);
  const folderPath = useFolderPath(showFolderPath ? hit.folderUid : undefined);

  const pluginId = getPluginId(hit.labels);
  // Managed rules get the provisioning badge too: they are owned by something outside the UI.
  const managerKind = fullRule.status === 'loaded' ? getManagerKind(fullRule.rule) : undefined;
  const isOwnedElsewhere = fullRule.status === 'loaded' && isProvisionedOrManaged(fullRule.rule);
  const hasQueriedDataSources = hit.dataSourceUids.some((uid) => getDataSourceByUid(uid) !== undefined);
  const hasDisplayLabels = Object.keys(hit.labels).some((key) => key !== GRAFANA_ORIGIN_LABEL);
  const titleId = `recording-rule-title-${hit.uid}`;

  const recordsTo =
    hit.metric || hit.targetDataSourceUid ? (
      <RecordsTo metric={hit.metric} targetDataSourceUid={hit.targetDataSourceUid} />
    ) : null;

  return (
    <RuleListItem
      aria-labelledby={titleId}
      icon={<RuleStatusIcon kind="recording" health={hit.health} paused={hit.paused} />}
      title={
        <Stack direction="row" alignItems="center" gap={1}>
          <TextLink
            id={titleId}
            href={`/alerting/grafana/${encodeURIComponent(hit.uid)}/view`}
            color="primary"
            inline={false}
          >
            {hit.title}
          </TextLink>
          {pluginId === undefined ? (
            isOwnedElsewhere && <ProvisioningBadge managerKind={managerKind} />
          ) : (
            <PluginOriginBadge pluginId={pluginId} size="sm" />
          )}
        </Stack>
      }
      description={
        hit.lastError ? (
          <Tooltip content={hit.lastError}>
            <Text variant="bodySmall" color="error" weight="light" truncate element="p">
              {hit.lastError}
            </Text>
          </Tooltip>
        ) : (
          recordsTo
        )
      }
      // Items are gated here on their data because the list item only drops falsy entries, so an
      // element that renders nothing would still leave a stray separator.
      meta={[
        folderPath && folderPath.length > 0 && <FolderPath key="folder" segments={folderPath} />,
        hit.lastError && recordsTo,
        hasQueriedDataSources && <DataSourcesMeta key="data-sources" uids={hit.dataSourceUids} />,
        hasDisplayLabels && <LabelsMeta key="labels" labels={hit.labels} />,
      ]}
      metaRight={<IntervalIndicator interval={hit.interval} />}
      actions={actions}
    />
  );
}

function RecordsTo({ metric, targetDataSourceUid }: { metric?: string; targetDataSourceUid?: string }) {
  const target = targetDataSourceUid ? getDataSourceByUid(targetDataSourceUid) : undefined;

  // An unresolvable target UID leaves nothing to say when the metric is also missing.
  if (!target && !metric) {
    return null;
  }

  let text: string;
  if (target && metric) {
    text = t('alerting.gma-rule-list.recording-rules.metric-and-target', 'Records {{metric}} to {{target}}', {
      metric,
      target: target.name,
    });
  } else if (target) {
    text = t('alerting.gma-rule-list.recording-rules.target-only', 'Records to {{target}}', { target: target.name });
  } else {
    text = t('alerting.gma-rule-list.recording-rules.metric-only', 'Records {{metric}}', { metric });
  }

  return (
    <Stack direction="row" alignItems="center" gap={0.5} wrap={false}>
      {target && <img alt="" src={target.meta.info.logos.small} width={16} height={16} />}
      <Text variant="bodySmall" color="secondary" truncate>
        {text}
      </Text>
    </Stack>
  );
}
