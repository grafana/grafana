import { useMemo } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert, Icon, LinkButton, Stack, Text } from '@grafana/ui';

import { createBridgeURL } from '../../components/PluginBridge';
import { WithReturnButton } from '../../components/WithReturnButton';
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { useRouteProxyActive } from '../../plugin-proxy/withRouteProxy';
import { SupportedPlugin } from '../../types/pluginBridges';
import { getExternalRulesSources } from '../../utils/datasource';

/**
 * All of these explain the same thing: some data sources' rules aren't in this list any more
 * because the Prometheus Alerting plugin shows them now. They render nothing unless the route proxy
 * is handing those rules to the plugin, or when there are no data source managed rules sources to
 * talk about, so callers can drop them in without a condition of their own.
 *
 * None are dismissible — they're the only explanation for why rules someone expects to see are
 * missing, so they need to stay put.
 */

/**
 * How many rules sources went to the plugin, and a link to its rule list carrying whatever the
 * person has typed into the search box.
 *
 * We forward the raw query rather than re-serializing the parsed filter: both sides speak the same
 * search grammar, and a round trip through the parser reorders and requotes terms, so what lands in
 * the plugin would no longer look like what they typed.
 */
function useHandedOverRules(): { count: number; pluginRulesLink: string } {
  const routeProxyActive = useRouteProxyActive();
  const { searchQuery } = useRulesFilter();

  const count = useMemo(() => (routeProxyActive ? getExternalRulesSources().length : 0), [routeProxyActive]);
  const pluginRulesLink = createBridgeURL(
    SupportedPlugin.PrometheusAlerting,
    '/rules',
    searchQuery ? { search: searchQuery } : {}
  );

  return { count, pluginRulesLink };
}

/** Sits above the flat rule list. */
export function DataSourceManagedRulesBanner() {
  const { count, pluginRulesLink } = useHandedOverRules();

  if (count === 0) {
    return null;
  }

  return (
    <Alert
      severity="info"
      title={t('alerting.rule-list.datasource-managed-notice.title', '', {
        count,
        defaultValue_one: '{{count}} data source is managed by the Prometheus Alerting plugin',
        defaultValue_other: '{{count}} data sources are managed by the Prometheus Alerting plugin',
      })}
    >
      <Stack direction="column" alignItems="flex-start" gap={1}>
        <Trans i18nKey="alerting.rule-list.datasource-managed-notice.body">
          Their alert and recording rules are no longer shown here.
        </Trans>
        <LinkButton size="sm" variant="secondary" icon="external-link-alt" href={pluginRulesLink}>
          <Trans i18nKey="alerting.rule-list.datasource-managed-notice.action">View rules in Prometheus Alerting</Trans>
        </LinkButton>
      </Stack>
    </Alert>
  );
}

/** The same message squeezed onto a single line, for a section header row. */
export function DataSourceManagedRulesInlineNotice() {
  const { count, pluginRulesLink } = useHandedOverRules();

  if (count === 0) {
    return null;
  }

  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      <Icon name="info-circle" size="sm" />
      <Text variant="bodySmall" color="secondary">
        {t('alerting.rule-list.datasource-managed-notice.inline', '', {
          count,
          defaultValue_one: '{{count}} data source is managed by the Prometheus Alerting plugin',
          defaultValue_other: '{{count}} data sources are managed by the Prometheus Alerting plugin',
        })}
      </Text>
      <WithReturnButton
        title={t('alerting.rule-list.return-button.title', 'Alert rules')}
        component={
          <LinkButton size="sm" variant="secondary" fill="text" href={pluginRulesLink}>
            <Trans i18nKey="alerting.rule-list.datasource-managed-notice.inline-action">View</Trans>
          </LinkButton>
        }
      />
    </Stack>
  );
}

/**
 * For when nothing matched in Grafana: the same search might match something in the plugin, which
 * has the data source managed rules this list no longer shows.
 */
export function SearchDataSourceManagedRulesButton() {
  const { count, pluginRulesLink } = useHandedOverRules();

  if (count === 0) {
    return null;
  }

  return (
    <WithReturnButton
      title={t('alerting.rule-list.return-button.title', 'Alert rules')}
      component={
        <LinkButton variant="secondary" icon="external-link-alt" href={pluginRulesLink}>
          <Trans i18nKey="alerting.rule-list.filter-view.search-in-plugin">
            Search data source managed rules in Prometheus Alerting
          </Trans>
        </LinkButton>
      }
    />
  );
}
