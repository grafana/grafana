import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const USE_LIVE_DATA = Boolean(process.env.API_CONFIG_PATH);
const API_CONFIG_PATH = process.env.API_CONFIG_PATH ?? '../dashboards/cujs/config.json';

const RELOADABLE_DASHBOARD_REQUEST_NO = 2;

async function loadApiConfig() {
  const configPath = path.resolve(__dirname, API_CONFIG_PATH);

  if (configPath.endsWith('.json')) {
    const configContent = await fs.promises.readFile(configPath, 'utf-8');
    return JSON.parse(configContent);
  } else {
    const apiConfigModule = await import(configPath);
    return apiConfigModule.default || apiConfigModule;
  }
}

export async function getConfigDashboards() {
  const config = await loadApiConfig();
  return config.dashboards || [];
}

export async function prepareAPIMocks(page: Page) {
  const apiConfig = await loadApiConfig();

  if (USE_LIVE_DATA) {
    return apiConfig;
  }

  const keys = Object.keys(apiConfig);

  if (keys.includes('labels')) {
    // mock the API call to get the labels
    const labels = ['asserts_env', 'cluster', 'job'];
    await page.route(apiConfig.labels, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: labels,
        }),
      });
    });
  }

  if (keys.includes('values')) {
    // mock the API call to get the values
    const values = ['value1', 'value2', 'test1', 'test2'];
    await page.route(apiConfig.values, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: values,
        }),
      });
    });
  }

  return apiConfig;
}

interface DashboardRequest {
  url: string;
  timestamp: number;
  response: { metadata: { annotations: string[] } };
}

export async function trackDashboardReloadRequests(page: Page): Promise<{
  getRequests: () => DashboardRequest[];
  waitForExpectedRequests: () => Promise<void>;
}> {
  const dashboardRequests: DashboardRequest[] = [];
  let resolveWhenComplete: () => void;
  let expectedRequestCount = 1; //initial request that gives us the meta param

  const completionPromise = new Promise<void>((resolve) => {
    resolveWhenComplete = resolve;
  });

  const handler = async (route) => {
    const response = await route.fetch();
    const responseJson = await response.json();
    const isFirstRequest = dashboardRequests.length === 0;

    dashboardRequests.push({
      url: route.request().url(),
      timestamp: Date.now(),
      response: responseJson,
    });

    // After first request, check if we should expect more
    if (isFirstRequest) {
      const hasReloadAnnotation = responseJson?.metadata?.annotations?.['grafana.app/reloadOnParamsChange'] === 'true';

      if (hasReloadAnnotation) {
        expectedRequestCount = RELOADABLE_DASHBOARD_REQUEST_NO;
      }
    }

    // Resolve if we've reached the expected count
    if (dashboardRequests.length >= expectedRequestCount) {
      resolveWhenComplete();
    }

    await route.fulfill({ response });
  };

  await page.route('**/dashboards/**/dto?**', handler);

  return {
    getRequests: () => dashboardRequests,
    waitForExpectedRequests: () => completionPromise,
  };
}

export function checkDashboardReloadBehavior(requests: DashboardRequest[]): boolean {
  if (requests.length === 0) {
    return false;
  }

  const firstRequest = requests[0];
  const hasReloadAnnotation =
    firstRequest?.response?.metadata?.annotations?.['grafana.app/reloadOnParamsChange'] === 'true';

  if (hasReloadAnnotation) {
    return requests.length === RELOADABLE_DASHBOARD_REQUEST_NO;
  } else {
    return requests.length === 1;
  }
}
