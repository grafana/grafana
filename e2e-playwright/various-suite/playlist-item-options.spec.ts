import { type Page } from '@playwright/test';

import { expect, test } from '@grafana/plugin-e2e';

const suffix = Date.now().toString(36);
const firstDashboardUID = `playlist-options-a-${suffix}`;
const secondDashboardUID = `playlist-options-b-${suffix}`;
const playlistUID = `playlist-options-${suffix}`;
const playlistAPI = `/apis/playlist.grafana.app/v1/namespaces/default/playlists`;

function dashboard(title: string, uid: string) {
  return {
    id: null,
    uid,
    title,
    schemaVersion: 41,
    panels: [
      {
        id: 1,
        type: 'text',
        title: 'Selected host',
        gridPos: { h: 8, w: 12, x: 0, y: 0 },
        options: { content: 'Current host: $host', mode: 'markdown' },
      },
    ],
    templating: {
      list: [
        {
          name: 'host',
          label: 'Host',
          type: 'custom',
          query: 'dev,prod',
          current: { selected: true, text: 'dev', value: 'dev' },
          options: [
            { selected: true, text: 'dev', value: 'dev' },
            { selected: false, text: 'prod', value: 'prod' },
          ],
        },
      ],
    },
  };
}

function itemRow(page: Page, itemUID: string) {
  return page.getByRole('row').filter({
    has: page.getByRole('cell', { name: `Playlist item, dashboard_by_uid, ${itemUID}` }),
  });
}

test.describe('Playlist item options', { tag: ['@various'] }, () => {
  test.beforeAll(async ({ request }) => {
    for (const [title, uid] of [
      ['Playlist options first dashboard', firstDashboardUID],
      ['Playlist options second dashboard', secondDashboardUID],
    ]) {
      const response = await request.post('/api/dashboards/db', {
        data: { dashboard: dashboard(title, uid), overwrite: true },
      });
      expect(response.ok()).toBe(true);
    }

    const response = await request.post(playlistAPI, {
      data: {
        apiVersion: 'playlist.grafana.app/v1',
        kind: 'Playlist',
        metadata: { name: playlistUID },
        spec: {
          title: `Playlist item options ${suffix}`,
          interval: '30s',
          items: [
            { type: 'dashboard_by_uid', value: firstDashboardUID },
            { type: 'dashboard_by_uid', value: secondDashboardUID },
          ],
        },
      },
    });
    expect(response.ok()).toBe(true);
  });

  test.afterAll(async ({ request }) => {
    await request.delete(`${playlistAPI}/${playlistUID}`);
    await request.delete(`/api/dashboards/uid/${firstDashboardUID}`);
    await request.delete(`/api/dashboards/uid/${secondDashboardUID}`);
  });

  test('persists a custom view and per-item interval and applies both during playback', async ({ page, request }) => {
    await page.goto(`/playlists/edit/${playlistUID}`);

    const firstRow = itemRow(page, firstDashboardUID);
    await expect(firstRow).toBeVisible();
    await firstRow.getByRole('button', { name: 'Settings' }).click();
    await firstRow.getByRole('textbox', { name: `Interval for ${firstDashboardUID}` }).fill('4s');
    await firstRow.getByRole('button', { name: 'Paste dashboard link' }).click();
    await firstRow
      .getByRole('textbox', { name: `Dashboard state for ${firstDashboardUID}` })
      .fill(`https://grafana.example.com/d/${firstDashboardUID}/playlist-options?var-host=prod&from=now-6h&to=now`);
    await firstRow.getByRole('button', { name: 'Apply' }).click();
    await expect(firstRow.getByText('Configured')).toBeVisible();

    const replaceResponsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().endsWith(`/playlists/${playlistUID}`)
    );
    await page.getByRole('button', { name: 'Save' }).click();
    expect((await replaceResponsePromise).ok()).toBe(true);
    await expect(page).toHaveURL(/\/playlists$/);

    const persistedResponse = await request.get(`${playlistAPI}/${playlistUID}`);
    expect(persistedResponse.ok()).toBe(true);
    const persisted = await persistedResponse.json();
    expect(persisted.spec.items).toEqual([
      {
        type: 'dashboard_by_uid',
        value: firstDashboardUID,
        interval: '4s',
        queryParams: 'var-host=prod&from=now-6h&to=now',
      },
      { type: 'dashboard_by_uid', value: secondDashboardUID },
    ]);

    await page.goto(`/playlists/edit/${playlistUID}`);
    await expect(itemRow(page, firstDashboardUID).getByText('Custom view · Interval: 4s')).toBeVisible();

    await page.goto(`/playlists/play/${playlistUID}`);
    await expect(page).toHaveURL(new RegExp(`/d/${firstDashboardUID}(?:/|\\?|$)`), { timeout: 15_000 });
    const firstDashboardURL = new URL(page.url());
    expect(firstDashboardURL.searchParams.get('var-host')).toBe('prod');
    expect(firstDashboardURL.searchParams.get('from')).toBe('now-6h');
    expect(firstDashboardURL.searchParams.get('to')).toBe('now');

    await expect(page).toHaveURL(new RegExp(`/d/${secondDashboardUID}(?:/|\\?|$)`), { timeout: 12_000 });
  });
});
