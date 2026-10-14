import { type ReactNode, useId } from 'react';

import { t } from '@grafana/i18n';
import { Stack, TextLink } from '@grafana/ui';

import { GRAFANA_RULES_SOURCE_NAME, getDataSourceByUid } from '../../utils/datasource';
import { isK8sEntityProvisioned } from '../../utils/k8s/utils';
import { createContactPointSearchLink } from '../../utils/misc';
import { useFolderPath } from '../folder-browsing/folderLookups';
import { useFullAlertRuleState } from '../rule-data/ruleResourceLookups';
import { DataSourcesMeta } from '../rule-row/DataSourcesMeta';
import { FolderPath } from '../rule-row/FolderPath';
import { LabelsMeta } from '../rule-row/LabelsMeta';
import { PluginOriginBadge } from '../rule-row/PluginOriginBadge';
import { ProvisioningBadge } from '../rule-row/ProvisioningBadge';
import { RuleListItem, RuleListItemDescription } from '../rule-row/RuleListItem';
import { RuleStatusIcon } from '../rule-row/RuleStatusIcon';
import { MetaItem } from '../shared/MetaItem';

import { type AlertRuleSearchHit } from './alertRuleSearchHit';

const GRAFANA_ORIGIN_LABEL = '__grafana_origin';

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
 * comes from the search hit plus enrichment caches the page already populates - this never
 * issues its own request. Missing runtime state/health renders a neutral "status unavailable"
 * icon, never a healthy default (alerting.ruleStatusSync may not have populated them yet).
 */
export function AlertRuleRow({ hit, showFolderPath, actions }: AlertRuleRowProps) {
  const titleId = useId();
  const fullRule = useFullAlertRuleState(hit.uid);
  const folderPath = useFolderPath(showFolderPath ? hit.folderUid : undefined);

  const pluginId = hit.labels[GRAFANA_ORIGIN_LABEL];
  const isProvisioned = fullRule.status === 'loaded' && isK8sEntityProvisioned(fullRule.rule);
  // Each meta entry is gated on its data here because the separator is added per truthy entry,
  // so a component that renders null would still leave a stray `|`.
  const hasQueriedDataSources = hit.dataSourceUids.some((uid) => getDataSourceByUid(uid) !== undefined);
  const hasDisplayLabels = Object.keys(hit.labels).some((key) => key !== GRAFANA_ORIGIN_LABEL);
  const isPaused = Boolean(hit.paused) || hit.health?.toLowerCase() === 'paused';

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
          {pluginId && <PluginOriginBadge pluginId={pluginId} size="sm" />}
          {!pluginId && isProvisioned && <ProvisioningBadge />}
        </Stack>
      }
      description={<RuleListItemDescription error={hit.lastError} summary={hit.summary} />}
      meta={[
        folderPath && folderPath.length > 0 && <FolderPath key="folder" segments={folderPath} />,
        hasQueriedDataSources && <DataSourcesMeta key="datasources" uids={hit.dataSourceUids} />,
        // Instance totals are skipped: the search backend does not accept the totals fields yet,
        // and requesting them would fail the whole search.
        hasDisplayLabels && <LabelsMeta key="labels" labels={hit.labels} />,
        // Paused rules do not notify, so routing would be misleading.
        !isPaused && <RoutingMeta key="routing" hit={hit} />,
      ]}
      // The effective interval depends on rule-sequence membership, which has no API yet;
      // showing the stored per-rule interval would be wrong for sequence members.
      metaRight={undefined}
      actions={actions}
    />
  );
}
