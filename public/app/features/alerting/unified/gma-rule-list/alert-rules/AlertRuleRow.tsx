import { type ReactNode, useId } from 'react';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { Stack, TextLink } from '@grafana/ui';

import { GRAFANA_RULES_SOURCE_NAME, getDataSourceByUid } from '../../utils/datasource';
import { createContactPointSearchLink } from '../../utils/misc';
import { grafanaRulesNav } from '../../utils/navigation';
import { getDisplayLabels, getManagerKind, getPluginId, isProvisionedOrManaged } from '../rule-data/ruleOwnership';
import { type RuleResourceState } from '../rule-data/ruleResourceState';
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
  fullRule: RuleResourceState<AlertRule>;
  /** List mode only. */
  folderPath?: string[];
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

/** Presentation-only; missing state/health renders "unavailable", never healthy. */
export function AlertRuleRow({ hit, fullRule, folderPath, actions }: AlertRuleRowProps) {
  const titleId = useId();

  const pluginId = getPluginId(hit.labels);
  // Managed rules get the provisioning badge too: they are owned by something outside the UI.
  const managerKind = fullRule.status === 'loaded' ? getManagerKind(fullRule.rule) : undefined;
  const isOwnedElsewhere = fullRule.status === 'loaded' && isProvisionedOrManaged(fullRule.rule);
  // Gate each entry: a null-rendering component would leave a stray separator.
  const hasQueriedDataSources = hit.dataSourceUids.some((uid) => getDataSourceByUid(uid) !== undefined);
  const hasTotals = Object.values(hit.totals).some((total) => total !== undefined);
  const hasDisplayLabels = Object.keys(getDisplayLabels(hit.labels)).length > 0;

  return (
    <RuleListItem
      aria-labelledby={titleId}
      icon={<RuleStatusIcon kind="alert" state={hit.state} health={hit.health} paused={hit.paused} />}
      title={
        <Stack direction="row" alignItems="center" gap={1} wrap={false}>
          <TextLink id={titleId} href={grafanaRulesNav.viewLink(hit.uid)} color="primary" inline={false}>
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
