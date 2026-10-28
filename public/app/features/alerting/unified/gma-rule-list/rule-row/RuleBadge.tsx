import { type ReactNode } from 'react';

import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { ProvisioningBadge } from '../../components/Provisioning';
import { PluginOriginBadge } from '../../plugins/PluginOriginBadge';
import { isK8sEntityProvisioned } from '../../utils/k8s/utils';
import { getRulePluginOrigin } from '../../utils/rules';

interface RuleBadgeProps {
  rule: Pick<AlertRule | RecordingRule, 'metadata' | 'spec'>;
}

/**
 * Renders the plugin badge when __grafana_origin starts with "plugin/",
 * otherwise the provisioning badge when the rule is provisioned, otherwise nothing.
 * Plugin badge takes priority.
 */
export function RuleBadge({ rule }: RuleBadgeProps): ReactNode {
  const pluginOrigin = getRulePluginOrigin({ labels: rule.spec?.labels });
  if (pluginOrigin) {
    return <PluginOriginBadge pluginId={pluginOrigin.pluginId} size="sm" />;
  }
  if (isK8sEntityProvisioned(rule)) {
    const provenance = rule.metadata?.annotations?.['grafana.com/provenance'];
    return <ProvisioningBadge tooltip provenance={provenance} />;
  }
  return null;
}
