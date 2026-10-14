import { type ReactNode, useId } from 'react';

import { t } from '@grafana/i18n';
import { Stack, TextLink } from '@grafana/ui';

import { GRAFANA_RULES_SOURCE_NAME, getDataSourceByUid } from '../../utils/datasource';
import { GRAFANA_ORIGIN_LABEL } from '../../utils/labels';
import { createContactPointSearchLink } from '../../utils/misc';
import { useFolderPath } from '../folder-browsing/folderLookups';
import { getManagerKind, getPluginId, isProvisionedOrManaged } from '../rule-data/ruleOwnership';
import { useFullAlertRuleState } from '../rule-data/ruleResourceLookups';
import { DataSourcesMeta } from '../rule-row/DataSourcesMeta';
import { FolderPath } from '../rule-row/FolderPath';
import { InstanceTotalsMeta } from '../rule-row/InstanceTotalsMeta';
import { IntervalIndicator } from '../rule-row/IntervalIndicator';
import { LabelsMeta } from '../rule-row/LabelsMeta';
import { PluginOriginBadge } from '../rule-row/PluginOriginBadge';
import { ProvisioningBadge } from '../rule-row/ProvisioningBadge';
import { RuleListItem, RuleListItemDescription } from '../rule-row/RuleListItem';
import { RuleStatusIcon } from '../rule-row/RuleStatusIcon';
import { MetaItem } from '../shared/MetaItem';

import { type AlertRuleSearchHit } from './alertRuleSearchHit';

interface AlertRuleRowProps {
  hit: AlertRuleSearchHit;
  /** Folder path is shown in List mode only - Folders mode already shows it on the folder
   * row, so repeating it on every rule row would be redundant. */
  showFolderPath: boolean;
  /** Rendered at the right edge of the row - the Edit button and actions menu. */
  actions?: ReactNode;
}

function RoutingMeta({ hit }: { hit: AlertRuleSearchHit }) {
  if (hit.notificationType === 'SimplifiedRouting' && hit.receiver) {
    return (
      <MetaItem icon="at">
        {t('alerting.gma-rule-list.alert-rules.routing-direct', 'Delivered to')}{' '}
        <TextLink
          href={createContactPointSearchLink(hit.receiver, GRAFANA_RULES_SOURCE_NAME)}
          variant="bodySmall"
          color="primary"
          inline={false}
        >
          {hit.receiver}
        </TextLink>
      </MetaItem>
    );
  }
  if (hit.notificationType === 'NamedRoutingTree' && hit.routingTree) {
    return (
      <MetaItem icon="at">
        {t('alerting.gma-rule-list.alert-rules.routing-named', 'Policy: {{policy}}', { policy: hit.routingTree })}
      </MetaItem>
    );
  }
  return <MetaItem icon="at">{t('alerting.gma-rule-list.alert-rules.routing-default', 'Default policy')}</MetaItem>;
}

/**
 * GMA-only Alert rule row for both Folders and List mode. Presentation-only: everything shown
 * comes from the search hit plus the folder-path and full-rule lookups, which are deduplicated
 * queries rather than anything the row manages. Missing runtime state/health renders a neutral "status unavailable"
 * icon, never a healthy default (alerting.ruleStatusSync may not have populated them yet).
 */
export function AlertRuleRow({ hit, showFolderPath, actions }: AlertRuleRowProps) {
  const titleId = useId();
  const fullRule = useFullAlertRuleState(hit.uid);
  const folderPath = useFolderPath(showFolderPath ? hit.folderUid : undefined);

  const pluginId = getPluginId(hit.labels);
  // Managed rules get the provisioning badge too: they are owned by something outside the UI.
  const managerKind = fullRule.status === 'loaded' ? getManagerKind(fullRule.rule) : undefined;
  const isOwnedElsewhere = fullRule.status === 'loaded' && isProvisionedOrManaged(fullRule.rule);
  // Each meta entry is gated on its data here because the separator is added per truthy entry,
  // so a component that renders null would still leave a stray `|`.
  const hasQueriedDataSources = hit.dataSourceUids.some((uid) => getDataSourceByUid(uid) !== undefined);
  const hasTotals = Object.values(hit.totals).some((total) => total !== undefined);
  const hasDisplayLabels = Object.keys(hit.labels).some((key) => key !== GRAFANA_ORIGIN_LABEL);

  return (
    <RuleListItem
      aria-labelledby={titleId}
      icon={<RuleStatusIcon kind="alert" state={hit.state} health={hit.health} paused={hit.paused} />}
      title={
        <Stack direction="row" alignItems="center" gap={1} wrap={false}>
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
      description={<RuleListItemDescription error={hit.lastError} summary={hit.summary} />}
      meta={[
        folderPath && folderPath.length > 0 && <FolderPath key="folder" segments={folderPath} />,
        hasQueriedDataSources && <DataSourcesMeta key="datasources" uids={hit.dataSourceUids} />,
        hasTotals && <InstanceTotalsMeta key="totals" totals={hit.totals} />,
        hasDisplayLabels && <LabelsMeta key="labels" labels={hit.labels} />,
        <RoutingMeta key="routing" hit={hit} />,
      ]}
      metaRight={<IntervalIndicator interval={hit.interval} />}
      actions={actions}
    />
  );
}
