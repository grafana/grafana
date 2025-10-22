import { config, registerEchoBackend, setEchoSrv } from '@grafana/runtime';
import { reportMetricPerformanceMark } from 'app/core/utils/metrics';

import { contextSrv } from '../context_srv';

import { Echo } from './Echo';

// Initialise EchoSrv backends, calls during frontend app startup
export async function initEchoSrv() {
  setEchoSrv(new Echo({ debug: process.env.NODE_ENV === 'development' }));

  window.addEventListener('load', (e) => {
    const loadMetricName = 'frontend_boot_load_time_seconds';
    // Metrics below are marked in public/views/index.html
    const jsLoadMetricName = 'frontend_boot_js_done_time_seconds';
    const cssLoadMetricName = 'frontend_boot_css_time_seconds';

    if (performance) {
      performance.mark(loadMetricName);
      reportMetricPerformanceMark('first-paint', 'frontend_boot_', '_time_seconds');
      reportMetricPerformanceMark('first-contentful-paint', 'frontend_boot_', '_time_seconds');
      reportMetricPerformanceMark(loadMetricName);
      reportMetricPerformanceMark(jsLoadMetricName);
      reportMetricPerformanceMark(cssLoadMetricName);
    }
  });

  try {
    await initPerformanceBackend();
  } catch (error) {
    console.error('Error initializing EchoSrv Performance backend', error);
  }

  try {
    await initFaroBackend();
  } catch (error) {
    console.error('Error initializing EchoSrv Faro backend', error);
  }

  try {
    await initGoogleAnalyticsBackend();
  } catch (error) {
    console.error('Error initializing EchoSrv GoogleAnalytics backend', error);
  }

  try {
    await initGoogleAnalaytics4Backend();
  } catch (error) {
    console.error('Error initializing EchoSrv GoogleAnalaytics4 backend', error);
  }

  try {
    await initRudderstackBackend();
  } catch (error) {
    console.error('Error initializing EchoSrv Rudderstack backend', error);
  }

  try {
    await initAzureAppInsightsBackend();
  } catch (error) {
    console.error('Error initializing EchoSrv AzureAppInsights backend', error);
  }

  try {
    await initConsoleBackend();
  } catch (error) {
    console.error('Error initializing EchoSrv Console backend', error);
  }
}

async function initPerformanceBackend() {
  if (contextSrv.user.orgRole === '') {
    return;
  }

  const { PerformanceBackend } = await import('./backends/PerformanceBackend');
  registerEchoBackend(new PerformanceBackend({}));
}

async function initFaroBackend() {
  if (!config.grafanaJavascriptAgent.enabled) {
    return;
  }

  // Ignore Rudderstack URLs
  const rudderstackUrls = [
    config.rudderstackConfigUrl,
    config.rudderstackDataPlaneUrl,
    config.rudderstackIntegrationsUrl,
  ]
    .filter(Boolean)
    .map((url) => new RegExp(`${url}.*.`));

  const { GrafanaJavascriptAgentBackend } = await import(
    './backends/grafana-javascript-agent/GrafanaJavascriptAgentBackend'
  );

  registerEchoBackend(
    new GrafanaJavascriptAgentBackend({
      buildInfo: config.buildInfo,
      userIdentifier: contextSrv.user.analytics.identifier,
      ignoreUrls: rudderstackUrls,

      apiKey: config.grafanaJavascriptAgent.apiKey,
      customEndpoint: config.grafanaJavascriptAgent.customEndpoint,
      consoleInstrumentalizationEnabled: config.grafanaJavascriptAgent.consoleInstrumentalizationEnabled,
      performanceInstrumentalizationEnabled: config.grafanaJavascriptAgent.performanceInstrumentalizationEnabled,
      cspInstrumentalizationEnabled: config.grafanaJavascriptAgent.cspInstrumentalizationEnabled,
      tracingInstrumentalizationEnabled: config.grafanaJavascriptAgent.tracingInstrumentalizationEnabled,
      webVitalsAttribution: config.grafanaJavascriptAgent.webVitalsAttribution,
      internalLoggerLevel: config.grafanaJavascriptAgent.internalLoggerLevel,
      botFilterEnabled: config.grafanaJavascriptAgent.botFilterEnabled,
    })
  );
}

async function initGoogleAnalyticsBackend() {
  if (!config.googleAnalyticsId) {
    return;
  }

  const { GAEchoBackend } = await import('./backends/analytics/GABackend');
  registerEchoBackend(
    new GAEchoBackend({
      googleAnalyticsId: config.googleAnalyticsId,
    })
  );
}

async function initGoogleAnalaytics4Backend() {
  if (!config.googleAnalytics4Id) {
    return;
  }

  const { GA4EchoBackend } = await import('./backends/analytics/GA4Backend');
  registerEchoBackend(
    new GA4EchoBackend({
      googleAnalyticsId: config.googleAnalytics4Id,
      googleAnalytics4SendManualPageViews: config.googleAnalytics4SendManualPageViews,
    })
  );
}

async function initRudderstackBackend() {
  if (!(config.rudderstackWriteKey && config.rudderstackDataPlaneUrl)) {
    return;
  }

  const { RudderstackBackend } = await import('./backends/analytics/RudderstackBackend');
  registerEchoBackend(
    new RudderstackBackend({
      writeKey: config.rudderstackWriteKey,
      dataPlaneUrl: config.rudderstackDataPlaneUrl,
      user: contextSrv.user,
      sdkUrl: config.rudderstackSdkUrl,
      configUrl: config.rudderstackConfigUrl,
      integrationsUrl: config.rudderstackIntegrationsUrl,
      buildInfo: config.buildInfo,
    })
  );
}

async function initAzureAppInsightsBackend() {
  if (!config.applicationInsightsConnectionString) {
    return;
  }

  const { ApplicationInsightsBackend } = await import('./backends/analytics/ApplicationInsightsBackend');
  registerEchoBackend(
    new ApplicationInsightsBackend({
      connectionString: config.applicationInsightsConnectionString,
      endpointUrl: config.applicationInsightsEndpointUrl,
    })
  );
}

async function initConsoleBackend() {
  if (!config.analyticsConsoleReporting) {
    return;
  }

  const { BrowserConsoleBackend } = await import('./backends/analytics/BrowseConsoleBackend');
  registerEchoBackend(new BrowserConsoleBackend());
}
