import { useEffect } from 'react';
import { Navigate } from 'react-router-dom-v5-compat';

import { reportInteraction } from '@grafana/runtime';

import { useReturnTo } from '../hooks/useReturnTo';
import { useURLSearchParams } from '../hooks/useURLSearchParams';
import { type PluginRuleRoute, prometheusAlertingPlugin } from '../utils/prometheusNavigation';

export function PluginRuleRedirect(props: PluginRuleRoute) {
  // Sanitized here rather than read raw, so a crafted returnTo can't be handed to the plugin.
  const { returnTo } = useReturnTo();
  const [searchParams] = useURLSearchParams();

  useEffect(() => {
    reportInteraction('grafana_alerting_prometheus_alerting_plugin_redirect', { action: props.action });
  }, [props.action]);

  return <Navigate replace to={pluginRuleTarget(props, searchParams, returnTo)} />;
}

function pluginRuleTarget(props: PluginRuleRoute, searchParams: URLSearchParams, returnTo?: string): string {
  switch (props.action) {
    case 'view':
      return prometheusAlertingPlugin.viewRule(props.identifier, {
        returnTo,
        tab: searchParams.get('tab') ?? undefined,
      });
    case 'edit':
      return prometheusAlertingPlugin.editRule(props.identifier, { returnTo });
    case 'clone':
      return prometheusAlertingPlugin.cloneRule(props.identifier, { returnTo });
    case 'create':
      return prometheusAlertingPlugin.newRule(props.ruleType, {
        defaults: searchParams.get('defaults') ?? undefined,
        returnTo,
      });
  }
}
