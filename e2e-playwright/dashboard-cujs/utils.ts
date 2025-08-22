import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const USE_LIVE_DATA = Boolean(process.env.API_CALLS_CONFIG_PATH);
const API_CALLS_CONFIG_PATH = process.env.API_CALLS_CONFIG_PATH ?? '../dashboards/cujs/config.json';

async function loadApiConfig(): Promise<any> {
  const configPath = path.resolve(__dirname, API_CALLS_CONFIG_PATH);

  if (configPath.endsWith('.json')) {
    const configContent = await fs.promises.readFile(configPath, 'utf-8');
    return JSON.parse(configContent);
  } else {
    const apiConfigModule = await import(configPath);
    return apiConfigModule.default || apiConfigModule;
  }
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
