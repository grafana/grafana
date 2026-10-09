import { defineConfig, type ReporterDescription } from '@playwright/test';

import { instrumentPlaywright } from '@grafana-cloud/test-observability';

import config from './playwright.config';

const resultsToken = process.env.GRAFANA_TEST_API_TOKEN;
const collectorUrl = process.env.GRAFANA_FARO_COLLECTOR_URL;

if (collectorUrl) {
  instrumentPlaywright({ url: collectorUrl, appName: 'grafana-e2e' });
}

const reporters: ReporterDescription[] =
  typeof config.reporter === 'string' ? [[config.reporter]] : (config.reporter ?? []);
const globalSetup = config.globalSetup
  ? typeof config.globalSetup === 'string'
    ? [config.globalSetup]
    : config.globalSetup
  : [];

export default defineConfig(config, {
  globalSetup: ['@grafana-cloud/test-observability/run-setup', ...globalSetup],
  reporter: [
    ...reporters,
    [
      '@grafana-cloud/test-observability/reporter',
      {
        outputFile: 'test-observability-results/replays.json',
        recording: {
          bundleDirectory: 'test-observability-results/bundles',
          upload: resultsToken
            ? {
                baseUrl:
                  process.env.GRAFANA_TEST_API_URL ?? 'https://testament-dev-us-central-0.grafana-dev.net/testament',
                token: resultsToken,
                stackId: process.env.GRAFANA_STACK_ID ?? '26320',
              }
            : undefined,
        },
      },
    ],
  ],
});
