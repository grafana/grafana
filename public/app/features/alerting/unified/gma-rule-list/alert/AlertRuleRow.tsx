import { type ReactNode } from 'react';

import { AlertLabels } from '@grafana/alerting/unstable';
import { t } from '@grafana/i18n';
import { Box, Stack, Text, TextLink, Tooltip } from '@grafana/ui';

import { ProvisioningBadge } from '../../components/Provisioning';
import { PluginOriginBadge } from '../../plugins/PluginOriginBadge';
import { getDataSourceByUid } from '../../utils/datasource';
import { isK8sEntityProvisioned } from '../../utils/k8s/utils';
import { useFolderPath, useFullAlertRuleState } from '../shared/caches';

import { type AlertRuleSearchHit } from './searchHit';

const GRAFANA_ORIGIN_LABEL = '__grafana_origin';

interface AlertRuleRowProps {
  hit: AlertRuleSearchHit;
  /** Folder path is shown in List mode only - Folders mode already shows it on the folder
   * row, so repeating it on every rule row would be redundant (alert-rules-page.md). */
  showFolderPath: boolean;
  /** Rendered after the row's own content - the action menu slot, once mounted by the page. */
  actions?: ReactNode;
}

function notificationRoutingLabel(hit: AlertRuleSearchHit): string {
  if (hit.notificationType === 'SimplifiedRouting' && hit.receiver) {
    return t('alerting.gma-rule-list.alert-rules.routing-direct', 'Delivered to {{receiver}}', {
      receiver: hit.receiver,
    });
  }
  if (hit.notificationType === 'NamedRoutingTree' && hit.routingTree) {
    return t('alerting.gma-rule-list.alert-rules.routing-named', 'Policy: {{policy}}', { policy: hit.routingTree });
  }
  return t('alerting.gma-rule-list.alert-rules.routing-default', 'Default policy');
}

/**
 * GMA-only Alert rule row for both Folders and List mode. Presentation-only: everything shown
 * comes from the search hit plus enrichment caches the page already populates - this never
 * issues its own request. Missing runtime state/health reads Unavailable, never a healthy
 * default (alerting.ruleStatusSync may not have populated them yet). Effective evaluation
 * interval is Unavailable until the rule-sequence membership contract exists - never inferred.
 */
export function AlertRuleRow({ hit, showFolderPath, actions }: AlertRuleRowProps) {
  const path = useFolderPath(showFolderPath ? hit.folderUid : undefined);
  const fullRule = useFullAlertRuleState(hit.uid);

  const pluginId = hit.labels[GRAFANA_ORIGIN_LABEL];
  const isProvisioned = fullRule.status === 'loaded' && isK8sEntityProvisioned(fullRule.rule);

  const displayLabels = Object.fromEntries(
    Object.entries(hit.labels).filter(([key]) => key !== GRAFANA_ORIGIN_LABEL)
  );
  const labelCount = Object.keys(displayLabels).length;
  const errorOrSummary = hit.lastError ?? hit.summary;
  const dataSources = Array.from(new Set(hit.dataSourceUids))
    .map(getDataSourceByUid)
    .filter((ds): ds is NonNullable<typeof ds> => ds !== undefined);

  const unavailable = t('alerting.gma-rule-list.alert-rules.unavailable', 'Unavailable');

  return (
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
      <Stack direction="column" gap={0.25} grow={1} minWidth={0}>
        <Stack direction="row" alignItems="center" gap={1}>
          <TextLink href={`/alerting/grafana/${hit.uid}/view`} inline={false}>
            {hit.title}
          </TextLink>
          {pluginId && <PluginOriginBadge pluginId={pluginId} size="sm" />}
          {!pluginId && isProvisioned && <ProvisioningBadge />}
          <Text color="secondary" variant="bodySmall">
            {hit.state ?? unavailable}
            {' · '}
            {hit.health ?? unavailable}
            {hit.paused && ` · ${t('alerting.gma-rule-list.alert-rules.paused', 'Paused')}`}
          </Text>
        </Stack>
        {errorOrSummary && (
          <Tooltip content={errorOrSummary}>
            <Text color="secondary" variant="bodySmall" truncate element="p">
              {errorOrSummary}
            </Text>
          </Tooltip>
        )}
        <Stack direction="row" alignItems="center" gap={1} wrap="wrap">
          {dataSources.length > 0 && (
            <Stack direction="row" alignItems="center" gap={0.5}>
              {dataSources.map((ds) => (
                <Tooltip key={ds.uid} content={ds.name}>
                  <img alt={`${ds.name} logo`} src={ds.meta.info.logos.small} width={16} height={16} />
                </Tooltip>
              ))}
            </Stack>
          )}
          {labelCount > 0 && (
            <Tooltip content={<AlertLabels labels={displayLabels} size="sm" />} interactive placement="right">
              <Text color="secondary" variant="bodySmall">
                {t('alerting.gma-rule-list.alert-rules.label-count', '', {
                  count: labelCount,
                  defaultValue_one: '{{count}} label',
                  defaultValue_other: '{{count}} labels',
                })}
              </Text>
            </Tooltip>
          )}
          <Text color="secondary" variant="bodySmall">
            {notificationRoutingLabel(hit)}
          </Text>
          <Text color="secondary" variant="bodySmall">
            {t('alerting.gma-rule-list.alert-rules.interval-unavailable', 'Interval: Unavailable')}
          </Text>
          {showFolderPath && (
            <Text color="secondary" variant="bodySmall">
              {path ? path.join(' / ') : ''}
            </Text>
          )}
        </Stack>
      </Stack>
      {actions && <Box shrink={0}>{actions}</Box>}
    </Stack>
  );
}
