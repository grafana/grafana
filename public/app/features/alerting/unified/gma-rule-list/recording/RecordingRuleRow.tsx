import { type ReactNode } from 'react';

import { AlertLabels } from '@grafana/alerting/unstable';
import { t } from '@grafana/i18n';
import { Stack, Text, TextLink, Tooltip } from '@grafana/ui';

import { ProvisioningBadge } from '../../components/Provisioning';
import { PluginOriginBadge } from '../../plugins/PluginOriginBadge';
import { getDataSourceByUid } from '../../utils/datasource';
import { isK8sEntityProvisioned } from '../../utils/k8s/utils';
import { useFolderPath, useFullRecordingRuleState } from '../shared/caches';

import { type RecordingRuleSearchHit } from './searchHit';

const GRAFANA_ORIGIN_LABEL = '__grafana_origin';

interface RecordingRuleRowProps {
  hit: RecordingRuleSearchHit;
  /** Folder path is shown in List mode only - Folders mode already shows it on the folder
   * row (recording-rules-page.md "Rule row"). */
  showFolderPath: boolean;
  actions?: ReactNode;
}

/**
 * GMA-only Recording rule row for both Folders and List mode. Presentation-only, same
 * enrichment-cache contract as AlertRuleRow. No alert state, instances, notification routing,
 * summary, Silence, or Declare-incident information - Recording rules have none of those.
 */
export function RecordingRuleRow({ hit, showFolderPath, actions }: RecordingRuleRowProps) {
  const path = useFolderPath(showFolderPath ? hit.folderUid : undefined);
  const fullRule = useFullRecordingRuleState(hit.uid);

  const pluginId = hit.labels[GRAFANA_ORIGIN_LABEL];
  const isProvisioned = fullRule.status === 'loaded' && isK8sEntityProvisioned(fullRule.rule);

  const displayLabels = Object.fromEntries(
    Object.entries(hit.labels).filter(([key]) => key !== GRAFANA_ORIGIN_LABEL)
  );
  const labelCount = Object.keys(displayLabels).length;

  const dataSources = Array.from(new Set(hit.dataSourceUids))
    .map(getDataSourceByUid)
    .filter((ds): ds is NonNullable<typeof ds> => ds !== undefined);
  const targetDataSource = hit.targetDataSourceUid ? getDataSourceByUid(hit.targetDataSourceUid) : undefined;

  const unavailable = t('alerting.gma-rule-list.recording-rules.unavailable', 'Unavailable');

  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" wrap="wrap">
      <Stack direction="column" gap={0.25}>
        <Stack direction="row" alignItems="center" gap={1}>
          <TextLink href={`/alerting/grafana/${hit.uid}/view`} inline={false}>
            {hit.title}
          </TextLink>
          {pluginId && <PluginOriginBadge pluginId={pluginId} size="sm" />}
          {!pluginId && isProvisioned && <ProvisioningBadge />}
          <Text color="secondary" variant="bodySmall">
            {hit.health ?? unavailable}
            {hit.paused && ` · ${t('alerting.gma-rule-list.recording-rules.paused', 'Paused')}`}
          </Text>
        </Stack>
        <Text color="secondary" variant="bodySmall">
          {t('alerting.gma-rule-list.recording-rules.metric-and-target', 'Records {{metric}} to {{target}}', {
            metric: hit.metric ?? unavailable,
            target: targetDataSource?.name ?? unavailable,
          })}
        </Text>
        {hit.lastError && (
          <Text color="secondary" variant="bodySmall">
            {hit.lastError}
          </Text>
        )}
        <Stack direction="row" alignItems="center" gap={1}>
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
                {t('alerting.gma-rule-list.recording-rules.label-count', '', {
                  count: labelCount,
                  defaultValue_one: '{{count}} label',
                  defaultValue_other: '{{count}} labels',
                })}
              </Text>
            </Tooltip>
          )}
          <Text color="secondary" variant="bodySmall">
            {t('alerting.gma-rule-list.recording-rules.interval-unavailable', 'Interval: Unavailable')}
          </Text>
          {showFolderPath && (
            <Text color="secondary" variant="bodySmall">
              {path ? path.join(' / ') : ''}
            </Text>
          )}
        </Stack>
      </Stack>
      {actions}
    </Stack>
  );
}
