import { type ReactNode } from 'react';

import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { ProvisioningBadge } from '../../components/Provisioning';
import { PluginOriginBadge } from '../../plugins/PluginOriginBadge';
import { K8sAnnotations } from '../../utils/k8s/constants';
import { getAnnotation, isProvisionedResource } from '../../utils/k8s/utils';
import { getRulePluginOrigin } from '../../utils/rules';

interface RuleOriginBadgeProps {
  rule: Pick<AlertRule | RecordingRule, 'metadata' | 'spec'>;
}

export function RuleOriginBadge({ rule }: RuleOriginBadgeProps): ReactNode {
  return <OriginBadge labels={rule.spec?.labels} provenance={getAnnotation(rule, K8sAnnotations.Provenance)} />;
}

/** The plugin badge for a rule managed by a plugin, otherwise the provisioning badge when it is provisioned. */
export function OriginBadge({ labels, provenance }: { labels?: Record<string, string>; provenance?: string }) {
  const pluginOrigin = getRulePluginOrigin({ labels });
  if (pluginOrigin) {
    return <PluginOriginBadge pluginId={pluginOrigin.pluginId} size="sm" />;
  }
  if (isProvisionedResource(provenance)) {
    return <ProvisioningBadge tooltip provenance={provenance} />;
  }
  return null;
}
