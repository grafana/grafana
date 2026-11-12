import { useCallback, useState } from 'react';

import { store } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, LinkButton, Text } from '@grafana/ui';

import { usePluginBridge } from '../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../types/pluginBridges';
import { createRelativeUrl } from '../../utils/url';

import { useHasDataSourceManagedRules } from './useHomeData';

type BannerVariant = 'managed' | 'install';

// Scoped per org and per variant: dismissing "install" must not hide "managed" once the plugin is installed.
export function getPrometheusAlertingBannerDismissedKey(orgId: number, variant: BannerVariant): string {
  return `grafana.alerting.home.prometheus_alerting_banner.${variant}.dismissed-org-${orgId}`;
}

/**
 * Tells people where their data source-managed rules live now that this page covers
 * Grafana-managed alerts only. Shown only when the stack has at least one such rule. Hidden while
 * the plugin check runs or if it fails, so "install" never shows to someone who has the plugin.
 */
export function PrometheusAlertingBanner() {
  const dataSourceRules = useHasDataSourceManagedRules();
  const plugin = usePluginBridge(SupportedPlugin.PrometheusAlerting);
  const orgId = config.bootData.user.orgId;
  const [dismissed, setDismissed] = useState<Record<BannerVariant, boolean>>(() => ({
    managed: store.getBool(getPrometheusAlertingBannerDismissedKey(orgId, 'managed'), false),
    install: store.getBool(getPrometheusAlertingBannerDismissedKey(orgId, 'install'), false),
  }));

  const variant: BannerVariant = plugin.installed ? 'managed' : 'install';
  // Alert renders its title in regular weight; the title goes in the body so it can be bold.
  const managedTitle = t(
    'alerting.home.prometheus-alerting-banner.managed-title',
    'Datasource-Managed Alert Rules are managed in Prometheus alerting'
  );
  const installTitle = t(
    'alerting.home.prometheus-alerting-banner.install-title',
    'Install Prometheus alerting to manage Datasource-Managed Alert Rules'
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
            <Trans i18nKey="alerting.home.prometheus-alerting-banner.managed-action">Open Prometheus alerting</Trans>
          </LinkButton>
        }
      >
        <Text element="p" weight="bold">
          {managedTitle}
        </Text>
        <Text>
          <Trans i18nKey="alerting.home.prometheus-alerting-banner.managed-body">
            This page covers Grafana-managed alert rules. Rules stored in your data sources, such as Prometheus, Mimir
            and Loki, are in the Prometheus alerting plugin.
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
          <Trans i18nKey="alerting.home.prometheus-alerting-banner.install-action">Install Prometheus alerting</Trans>
        </LinkButton>
      }
    >
      <Text element="p" weight="bold">
        {installTitle}
      </Text>
      <Text>
        <Trans i18nKey="alerting.home.prometheus-alerting-banner.install-body">
          This page covers Grafana-managed alert rules. The Prometheus alerting plugin is the recommended place for
          rules stored in your data sources, such as Prometheus, Mimir and Loki. Until you install it, they stay in the
          alert rule list.
        </Trans>
      </Text>
    </Alert>
  );
}
