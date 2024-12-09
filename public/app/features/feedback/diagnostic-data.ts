import { config, getBackendSrv } from '@grafana/runtime';

export async function getDiagnosticData() {
  const externallyInstalledPlugins = await getBackendSrv().get('/api/plugins', { embedded: 0, core: 0, enabled: 1 });

  return {
    instance: {
      // slug will be populated on the backend when running in Hosted Grafana
      version: config?.buildInfo?.versionString,
      edition: config?.licenseInfo?.edition,
      apps: Object.keys(config?.apps),
      database: {
        sqlConnectionLimits: config?.sqlConnectionLimits,
      },
      externallyInstalledPlugins: externallyInstalledPlugins.map(
        (plugin: { name: string; info: { version: string; updated: string } }) => ({
          name: plugin.name,
          version: plugin.info.version,
          buildDate: plugin.info.updated,
        })
      ),
      featureToggles: Object.keys(config?.featureToggles),
      rbacEnabled: config.rbacEnabled,
      samlEnabled: config.samlEnabled,
      ldapEnabled: config.ldapEnabled,
      hasAngularsupport: config.angularSupportEnabled,
      authProxyEnabled: config.authProxyEnabled,
      expressionsEnabled: config.expressionsEnabled,
      publicDashboardsEnabled: config.publicDashboardsEnabled,
      queryHistoryEnabled: config.queryHistoryEnabled,
      recordedQueriesEnabled: config.recordedQueries.enabled,
      reportingEnabled: config.reporting.enabled,
      secureSocksDSProxyEnabled: config.secureSocksDSProxyEnabled,
      imageRendererAvailable: config.rendererAvailable,
      datasources: Array.from(
        new Map(
          Object.values(config?.datasources).map((settings) => [
            settings.meta.name,
            {
              name: settings.meta.name,
              type: settings.type,
              ...(settings?.meta?.info?.version && { version: settings?.meta?.info?.version }),
            },
          ])
        ).values()
      ),
      unifiedAlerting: {
        enabled: config.unifiedAlertingEnabled,
        ...(config.unifiedAlertingEnabled && { minInterval: config.unifiedAlerting.minInterval }),
      },
      panels: Object.keys(config.panels),
    },
    browser: {
      userAgent: navigator?.userAgent,
      cookiesEnabled: navigator?.cookieEnabled,
      hasTouchScreen: navigator?.maxTouchPoints > 0,
    },
  };
}
