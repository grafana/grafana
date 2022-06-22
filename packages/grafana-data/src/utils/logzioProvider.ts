// LOGZ.IO GRAFANA CHANGE
export let logzioDeprecatedAngularServices: any = {};
export let logzioServices: any = {};
export let logzioConfigs: any = {};
export let productLoaded: any = {};

if ((global as any).window) {
  const logzioConfigurations = (window as any).logzio;
  if (logzioConfigurations) {
    logzioConfigs = logzioConfigurations.configs || {};
    logzioDeprecatedAngularServices = logzioConfigurations.services || {};
    productLoaded = logzioConfigurations.productLoaded || {};
    if ((global as any).parent.__logzio__) {
      logzioServices = (global as any).parent.__logzio__.services || {};
    }
  }
}
