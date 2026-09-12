import { Trans, t } from '@grafana/i18n';
import { Alert, Icon, LinkButton, Stack, Text } from '@grafana/ui';

import { useHandedOverRulesSources, usePluginRulesLink } from '../../plugin-proxy/usePrometheusAlertingPlugin';

/**
 * Both of these explain the same thing: some data sources' rules aren't in this list any more
 * because the Prometheus Alerting plugin shows them now. They render nothing when the plugin isn't
 * installed or when there are no data source managed rules sources to talk about, so callers can
 * drop them in without a condition of their own.
 *
 * Neither is dismissible — they're the only explanation for why rules someone expects to see are
 * missing, so they need to stay put.
 */

/** Sits above the flat rule list. */
export function DataSourceManagedRulesBanner() {
  const rulesSources = useHandedOverRulesSources();
  const pluginRulesLink = usePluginRulesLink();

  if (rulesSources.length === 0) {
    return null;
  }

  return (
    <Alert
      severity="info"
      title={t('alerting.rule-list.datasource-managed-notice.title', '', {
        count: rulesSources.length,
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
  const rulesSources = useHandedOverRulesSources();
  const pluginRulesLink = usePluginRulesLink();

  if (rulesSources.length === 0) {
    return null;
  }

  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      <Icon name="info-circle" size="sm" />
      <Text variant="bodySmall" color="secondary">
        {t('alerting.rule-list.datasource-managed-notice.inline', '', {
          count: rulesSources.length,
          defaultValue_one: '{{count}} data source is managed by the Prometheus Alerting plugin',
          defaultValue_other: '{{count}} data sources are managed by the Prometheus Alerting plugin',
        })}
      </Text>
      <LinkButton size="sm" variant="secondary" fill="text" href={pluginRulesLink}>
        <Trans i18nKey="alerting.rule-list.datasource-managed-notice.inline-action">View</Trans>
      </LinkButton>
    </Stack>
  );
}
