import { useCallback, useState } from 'react';
import { useAsync } from 'react-use';

import { store } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, isAppPluginInstalled } from '@grafana/runtime';
import { Alert, LinkButton, Text } from '@grafana/ui';

import { SupportedPlugin } from '../../types/pluginBridges';
import { createRelativeUrl } from '../../utils/url';

import { useHasRuleCapableDataSource } from './useHomeData';

type BannerVariant = 'managed' | 'install';

// Scoped per org and per variant: dismissing "install" must not hide "managed" once the plugin is installed.
export function getPrometheusAlertingBannerDismissedKey(orgId: number, variant: BannerVariant): string {
  return `grafana.alerting.home.prometheus_alerting_banner.${variant}.dismissed-org-${orgId}`;
}

/**
 * Whether an app plugin is installed, read from the plugin list the page already has, so it makes no request.
 * That list does not say whether the app is enabled, so a disabled one counts as installed.
 */
function usePluginInstalled(pluginId: string): { loading: boolean; installed?: boolean; error?: unknown } {
  const { value, error } = useAsync(() => isAppPluginInstalled(pluginId), [pluginId]);
  // useAsync flips `loading` in an effect, so the first render reports a settled state with no value.
  return { loading: value === undefined && !error, installed: value, error };
}

/**
 * Tells people where their data source-managed rules live now that this page covers Grafana-managed
 * alerts only. Shown when the stack has a data source that can hold rules, and hidden while the plugin
 * check runs, so "install" never flashes for someone who has the plugin.
 */
export function PrometheusAlertingBanner() {
  const dataSourceRules = useHasRuleCapableDataSource();
  const plugin = usePluginInstalled(SupportedPlugin.PrometheusAlerting);
  const orgId = config.bootData.user.orgId;
  const [dismissed, setDismissed] = useState<Record<BannerVariant, boolean>>(() => ({
    managed: store.getBool(getPrometheusAlertingBannerDismissedKey(orgId, 'managed'), false),
    install: store.getBool(getPrometheusAlertingBannerDismissedKey(orgId, 'install'), false),
  }));

  const variant: BannerVariant = plugin.installed ? 'managed' : 'install';
  // Alert renders its title in regular weight; the title goes in the body so it can be bold.
  const managedTitle = t(
    'alerting.home.prometheus-alerting-banner.managed-title',
    'Datasource-Managed Alert Rules are managed in Prometheus Alerting'
  );
  const installTitle = t(
    'alerting.home.prometheus-alerting-banner.install-title',
    'Install the Prometheus Alerting plugin to manage data source-managed rules'
  );

  const dismiss = useCallback(() => {
    store.set(getPrometheusAlertingBannerDismissedKey(orgId, variant), true);
    setDismissed((current) => ({ ...current, [variant]: true }));
  }, [orgId, variant]);

  if (dataSourceRules.loading || !dataSourceRules.value || plugin.loading || plugin.error || dismissed[variant]) {
    return null;
  }

  if (variant === 'managed') {
    return (
      <Alert
        severity="info"
        title=""
        aria-label={managedTitle}
        onRemove={dismiss}
        action={
          <LinkButton
            size="sm"
            variant="secondary"
            href={createRelativeUrl(`/a/${SupportedPlugin.PrometheusAlerting}/rules`)}
          >
            <Trans i18nKey="alerting.home.prometheus-alerting-banner.managed-action">Open Prometheus Alerting</Trans>
          </LinkButton>
        }
      >
        <Text element="p" weight="bold">
          {managedTitle}
        </Text>
        <Text>
          <Trans i18nKey="alerting.home.prometheus-alerting-banner.managed-body">
            This page covers Grafana-managed alert rules. Rules stored in your data sources, such as Prometheus, Mimir
            and Loki, are in the Prometheus Alerting plugin.
          </Trans>
        </Text>
      </Alert>
    );
  }

  return (
    <Alert
      severity="info"
      title=""
      aria-label={installTitle}
      onRemove={dismiss}
      action={
        <LinkButton
          size="sm"
          variant="secondary"
          href={createRelativeUrl(`/plugins/${SupportedPlugin.PrometheusAlerting}`)}
        >
          <Trans i18nKey="alerting.home.prometheus-alerting-banner.install-action">Install Prometheus Alerting</Trans>
        </LinkButton>
      }
    >
      <Text element="p" weight="bold">
        {installTitle}
      </Text>
      <Text>
        <Trans i18nKey="alerting.home.prometheus-alerting-banner.install-body">
          Grafana Alerting is focused on Grafana-managed alert rules. To create, edit and manage rules stored in your
          data sources, such as Prometheus, Mimir and Loki, you need to install the Prometheus Alerting plugin.
        </Trans>
      </Text>
    </Alert>
  );
}
