import { type ReactNode } from 'react';

import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { ProvisioningBadge } from '../../components/Provisioning';
import { PluginOriginBadge } from '../../plugins/PluginOriginBadge';
import { K8sAnnotations } from '../../utils/k8s/constants';
import { getAnnotation, isK8sEntityProvisioned } from '../../utils/k8s/utils';
import { getRulePluginOrigin } from '../../utils/rules';

interface RuleOriginBadgeProps {
  rule: Pick<AlertRule | RecordingRule, 'metadata' | 'spec'>;
}

/**
 * Renders the plugin badge when __grafana_origin starts with "plugin/",
 * otherwise the provisioning badge when the rule is provisioned, otherwise nothing.
 * Plugin badge takes priority.
 */
export function RuleOriginBadge({ rule }: RuleOriginBadgeProps): ReactNode {
  const pluginOrigin = getRulePluginOrigin({ labels: rule.spec?.labels });
  if (pluginOrigin) {
    return <PluginOriginBadge pluginId={pluginOrigin.pluginId} size="sm" />;
  }
  if (isK8sEntityProvisioned(rule)) {
    return <ProvisioningBadge tooltip provenance={getAnnotation(rule, K8sAnnotations.Provenance)} />;
  }
  return null;
}
