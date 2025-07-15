import { Page } from '@playwright/test';

export async function getResources(page: Page): Promise<void> {
  // Mock the Prometheus API responses
  await page.route(/__name__/g, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        data: ['metric1', 'metric2'],
      }),
    });
  });

  await page.route(/metadata/g, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        data: {
          metric1: [
            {
              type: 'counter',
              help: 'metric1 help',
              unit: '',
            },
          ],
          metric2: [
            {
              type: 'counter',
              help: 'metric2 help',
              unit: '',
            },
          ],
        },
      }),
    });
  });

  await page.route(/labels/g, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        data: ['__name__', 'action', 'active', 'backend'],
      }),
    });
  });
}
