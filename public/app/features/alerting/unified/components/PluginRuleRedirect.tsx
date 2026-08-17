import { useEffect } from 'react';
import { Navigate } from 'react-router-dom-v5-compat';

import { reportInteraction } from '@grafana/runtime';

import { prometheusAlertingPlugin } from '../utils/prometheusNavigation';

type PluginRuleIdentifier = Parameters<typeof prometheusAlertingPlugin.viewRule>[0];

interface PluginRuleRedirectProps {
  identifier: PluginRuleIdentifier;
  action: 'view' | 'edit' | 'clone';
}

export function PluginRuleRedirect({ identifier, action }: PluginRuleRedirectProps) {
  useEffect(() => {
    reportInteraction('grafana_alerting_prometheus_alerting_plugin_redirect', { action });
  }, [action]);

  const target = {
    view: prometheusAlertingPlugin.viewRule,
    edit: prometheusAlertingPlugin.editRule,
    clone: prometheusAlertingPlugin.cloneRule,
  }[action](identifier);

  return <Navigate replace to={target} />;
}
