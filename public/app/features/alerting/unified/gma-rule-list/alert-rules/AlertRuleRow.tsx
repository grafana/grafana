import { type ReactNode, useId } from 'react';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { Stack, TextLink } from '@grafana/ui';

import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { GRAFANA_ORIGIN_LABEL } from '../../utils/labels';
import { createContactPointSearchLink } from '../../utils/misc';
import { grafanaRulesNav } from '../../utils/navigation';
import { getManagerKind, getPluginId, isProvisionedOrManaged } from '../rule-data/ruleOwnership';
import { type RuleResourceState } from '../rule-data/ruleResourceState';
import { FolderPath } from '../rule-row/FolderPath';
import { InstanceTotalsMeta } from '../rule-row/InstanceTotalsMeta';
import { PluginOriginBadge } from '../rule-row/PluginOriginBadge';
import { ProvisioningBadge } from '../rule-row/ProvisioningBadge';
import { RuleDatasources } from '../rule-row/RuleDatasources';
import { RuleDescription } from '../rule-row/RuleDescription';
import { RuleInterval } from '../rule-row/RuleInterval';
import { RuleLabels } from '../rule-row/RuleLabels';
import { RuleListItem } from '../rule-row/RuleListItem';
import { RuleStatusIcon } from '../rule-row/RuleStatusIcon';
import { MetaItem } from '../shared/MetaItem';

import { type AlertRuleSearchHit } from './alertRuleSearchHit';

interface AlertRuleRowProps {
  searchHit: AlertRuleSearchHit;
  fullRule: RuleResourceState<AlertRule>;
  /** Absent while the folder path loads, when its lookup failed, or in Folders mode. */
  folderPath?: string[];
  actions?: ReactNode;
}

function RoutingMeta({ searchHit }: { searchHit: AlertRuleSearchHit }) {
  if (searchHit.notificationType === 'SimplifiedRouting' && searchHit.receiver) {
    return (
      <MetaItem icon="at">
        {t('alerting.gma-rule-list.alert-rules.routing-direct', 'Delivered to')}{' '}
        <TextLink
          href={createContactPointSearchLink(searchHit.receiver, GRAFANA_RULES_SOURCE_NAME)}
          variant="bodySmall"
          color="primary"
        >
          {searchHit.receiver}
        </TextLink>
      </MetaItem>
    );
  }
  if (searchHit.notificationType === 'NamedRoutingTree' && searchHit.routingTree) {
    return (
      <MetaItem icon="at">
        {t('alerting.gma-rule-list.alert-rules.routing-named', 'Policy: {{policy}}', { policy: searchHit.routingTree })}
      </MetaItem>
    );
  }
  return <MetaItem icon="at">{t('alerting.gma-rule-list.alert-rules.routing-default', 'Default policy')}</MetaItem>;
}

/** Presentation-only; missing state/health renders "unavailable", never healthy. */
export function AlertRuleRow({ searchHit, fullRule, folderPath, actions }: AlertRuleRowProps) {
  const titleId = useId();

  const pluginId = getPluginId(
    searchHit.originLabel === undefined ? undefined : { [GRAFANA_ORIGIN_LABEL]: searchHit.originLabel }
  );
  // Managed rules get the provisioning badge too: they are owned by something outside the UI.
  const managerKind = fullRule.status === 'loaded' ? getManagerKind(fullRule.rule) : undefined;
  const isOwnedElsewhere = fullRule.status === 'loaded' && isProvisionedOrManaged(fullRule.rule);

  return (
    <RuleListItem
      aria-labelledby={titleId}
      icon={<RuleStatusIcon kind="alert" state={searchHit.state} health={searchHit.health} paused={searchHit.paused} />}
      title={
        <Stack direction="row" alignItems="center" gap={1} wrap={false}>
          <TextLink id={titleId} href={grafanaRulesNav.viewLink(searchHit.uid)} color="primary" inline={false}>
            {searchHit.title}
          </TextLink>
          {pluginId === undefined ? (
            isOwnedElsewhere && <ProvisioningBadge managerKind={managerKind} />
          ) : (
            <PluginOriginBadge pluginId={pluginId} size="sm" />
          )}
        </Stack>
      }
      description={
        (searchHit.lastError || searchHit.summary) && (
          <RuleDescription lastError={searchHit.lastError} summary={searchHit.summary} />
        )
      }
      right={
        (searchHit.interval || actions) && (
          <>
            {searchHit.interval && <RuleInterval interval={searchHit.interval} />}
            {actions}
          </>
        )
      }
      meta={[
        folderPath && folderPath.length > 0 && <FolderPath key="folder" segments={folderPath} />,
        searchHit.datasourceUIDs && searchHit.datasourceUIDs.length > 0 && (
          <RuleDatasources key="ds" datasourceUIDs={searchHit.datasourceUIDs} />
        ),
        searchHit.totals && <InstanceTotalsMeta key="totals" totals={searchHit.totals} />,
        // parseSearchLabels guarantees labels is non-empty when present; RuleLabels handles the null case.
        searchHit.labels && <RuleLabels key="labels" labels={searchHit.labels} />,
        <RoutingMeta key="routing" searchHit={searchHit} />,
      ]}
    />
  );
}
