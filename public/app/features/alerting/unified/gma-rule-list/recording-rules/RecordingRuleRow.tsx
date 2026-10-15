import { type ReactNode } from 'react';

import { type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { Stack, Text, TextLink } from '@grafana/ui';

import { getDataSourceByUid } from '../../utils/datasource';
import { getDisplayLabels, getManagerKind, getPluginId, isProvisionedOrManaged } from '../rule-data/ruleOwnership';
import { type RuleResourceState } from '../rule-data/ruleResourceState';
import { DataSourcesMeta } from '../rule-row/DataSourcesMeta';
import { FolderPath } from '../rule-row/FolderPath';
import { IntervalIndicator } from '../rule-row/IntervalIndicator';
import { LabelsMeta } from '../rule-row/LabelsMeta';
import { PluginOriginBadge } from '../rule-row/PluginOriginBadge';
import { ProvisioningBadge } from '../rule-row/ProvisioningBadge';
import { RuleListItem, RuleListItemDescription } from '../rule-row/RuleListItem';
import { RuleStatusIcon } from '../rule-row/RuleStatusIcon';

import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

interface RecordingRuleRowProps {
  hit: RecordingRuleSearchHit;
  fullRule: RuleResourceState<RecordingRule>;
  /** List mode only; Folders mode shows the folder on the folder row. */
  folderPath?: string[];
  actions?: ReactNode;
}

export function RecordingRuleRow({ hit, fullRule, folderPath, actions }: RecordingRuleRowProps) {
  const pluginId = getPluginId(hit.labels);
  const managerKind = fullRule.status === 'loaded' ? getManagerKind(fullRule.rule) : undefined;
  const isOwnedElsewhere = fullRule.status === 'loaded' && isProvisionedOrManaged(fullRule.rule);
  const hasQueriedDataSources = hit.dataSourceUids.some((uid) => getDataSourceByUid(uid) !== undefined);
  const hasDisplayLabels = Object.keys(getDisplayLabels(hit.labels)).length > 0;
  const titleId = `recording-rule-title-${hit.uid}`;
  const target = hit.targetDataSourceUid ? getDataSourceByUid(hit.targetDataSourceUid) : undefined;
  const hasRecordsTo = Boolean(hit.metric) || target !== undefined;

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
      description={<RuleListItemDescription error={hit.lastError} />}
      // Gate on data: the list item only drops falsy entries, so an empty element leaves a stray separator.
      meta={[
        folderPath && folderPath.length > 0 && <FolderPath key="folder" segments={folderPath} />,
        hasRecordsTo && <RecordsTo key="records-to" metric={hit.metric} target={target} />,
        hasQueriedDataSources && <DataSourcesMeta key="data-sources" uids={hit.dataSourceUids} />,
        hasDisplayLabels && <LabelsMeta key="labels" labels={hit.labels} />,
      ]}
      metaRight={<IntervalIndicator interval={hit.interval} />}
      actions={actions}
    />
  );
}

interface RecordsToProps {
  metric?: string;
  target?: ReturnType<typeof getDataSourceByUid>;
}

function RecordsTo({ metric, target }: RecordsToProps) {
  let text: string;
  if (target && metric) {
    text = t('alerting.gma-rule-list.recording-rules.metric-and-target', 'Records {{metric}} to', { metric });
  } else if (target) {
    text = t('alerting.gma-rule-list.recording-rules.target-only', 'Records to');
  } else {
    text = t('alerting.gma-rule-list.recording-rules.metric-only', 'Records {{metric}}', { metric });
  }

  return (
    <Stack direction="row" alignItems="center" gap={0.5} wrap={false}>
      <Text variant="bodySmall" color="secondary">
        {text}
      </Text>
      {target && (
        <>
          <img alt="" src={target.meta.info.logos.small} width={16} height={16} />
          <Text variant="bodySmall" color="secondary">
            {target.name}
          </Text>
        </>
      )}
    </Stack>
  );
}
