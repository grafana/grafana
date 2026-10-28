import { type ReactNode } from 'react';

import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { ProvisioningBadge } from '../../components/Provisioning';
import { PluginOriginBadge } from '../../plugins/PluginOriginBadge';
import { isK8sEntityProvisioned } from '../../utils/k8s/utils';

interface RuleBadgeProps {
  rule: Pick<AlertRule | RecordingRule, 'metadata' | 'spec'>;
}

/**
 * Renders the plugin badge when __grafana_origin starts with "plugin/",
 * otherwise the provisioning badge when the rule is provisioned, otherwise nothing.
 * Plugin badge takes priority.
 */
export function RuleBadge({ rule }: RuleBadgeProps): ReactNode {
  const origin = rule.spec?.labels?.__grafana_origin;
  if (origin?.startsWith('plugin/')) {
    return <PluginOriginBadge pluginId={origin.slice('plugin/'.length)} size="sm" />;
  }
  if (isK8sEntityProvisioned(rule)) {
    const provenance = rule.metadata?.annotations?.['grafana.com/provenance'];
    return <ProvisioningBadge tooltip provenance={provenance} />;
  }
  return null;
}
