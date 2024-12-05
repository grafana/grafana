import { config, getBackendSrv } from '@grafana/runtime';

export async function getDiagnosticData() {
  const externallyInstalledPlugins = await getBackendSrv().get('/api/plugins', { embedded: 0, core: 0, enabled: 1 });

  return {
    instance: {
      version: config?.buildInfo?.versionString,
      edition: config?.licenseInfo?.edition,
      apps: Object.keys(config?.apps),
      database: {
        sqlConnectionLimits: config?.sqlConnectionLimits,
      },
      externallyInstalledPlugins: externallyInstalledPlugins.map((plugin: { name: string; info: { version: string; updated: string; }; }) => ({
        name: plugin.name,
        version: plugin.info.version,
        buildDate: plugin.info.updated,
      })),
      featureToggles: Object.keys(config?.featureToggles),
      rbacEnabled: config.rbacEnabled,
      samlEnabled: config.samlEnabled,
      imageRendererAvailable: config.rendererAvailable,
      datasources: Object.values(config?.datasources).map(settings => ({
        name: settings.meta.name,
        type: settings.type,
        ...(settings?.meta?.info?.version && { version: settings?.meta?.info?.version }),
      })),
      panels: Object.keys(config.panels),
    },
    browser: {
      userAgent: navigator?.userAgent,
      cookiesEnabled: navigator?.cookieEnabled,
      hasTouchScreen: navigator?.maxTouchPoints > 0,
    },
  };
}
