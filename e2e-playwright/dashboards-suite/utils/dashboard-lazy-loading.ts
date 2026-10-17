import { type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import { test as base, expect } from '@grafana/plugin-e2e';

export const test = base.extend<{ dashboardUid: string; dashboardTitle: string; dashboardPath: string }>({
  dashboardUid: async ({}, provide) => {
    await provide(randomUUID());
  },
  dashboardTitle: async ({ dashboardUid }, provide) => {
    await provide(`Lazy loading review ${dashboardUid}`);
  },
  dashboardPath: [
    async ({ page, dashboardUid, dashboardTitle }, provide) => {
      expect((await page.request.post('/login', { data: { user: 'admin', password: 'admin' } })).ok()).toBe(true);
      const response = await page.request.post('/api/dashboards/db', {
        data: {
          overwrite: true,
          dashboard: {
            uid: dashboardUid,
            title: dashboardTitle,
            schemaVersion: 42,
            editable: true,
            time: { from: 'now-6h', to: 'now' },
            templating: {
              list: [
                {
                  name: 'Filters',
                  type: 'adhoc',
                  datasource: { type: 'grafana', uid: '-- Grafana --' },
                  filters: [{ key: 'environment', operator: '=', value: 'production' }],
                },
              ],
            },
            panels: [
              {
                id: 1,
                type: 'text',
                title: 'Review panel',
                gridPos: { x: 0, y: 0, w: 12, h: 8 },
                options: { mode: 'markdown', content: 'Browser review content' },
              },
            ],
          },
        },
      });
      expect(response.ok(), await response.text()).toBe(true);
      try {
        await provide(`/d/${dashboardUid}`);
      } finally {
        const response = await page.request.delete(`/api/dashboards/uid/${dashboardUid}`);
        expect(response.ok(), await response.text()).toBe(true);
      }
    },
    { auto: true },
  ],
});

export async function holdChunk(page: Page, pattern: RegExp) {
  const pending = Promise.withResolvers<void>();
  let intercepted = false;
  await page.route(pattern, async (route) => {
    intercepted = true;
    await pending.promise;
    await route.continue();
  });
  return {
    wait: () =>
      expect.poll(() => intercepted, { message: 'The intended lazy chunk must actually be requested' }).toBe(true),
    release: async () => {
      const loaded = page.waitForResponse(pattern);
      pending.resolve();
      await (await loaded).finished();
      await page.unroute(pattern);
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      );
    },
  };
}

export async function openShare(page: Page) {
  await page.getByTestId('data-testid new share button arrow menu').click();
  await page.getByTestId('data-testid new share button share internally').click();
}
