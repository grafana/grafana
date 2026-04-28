import { type Page } from '@playwright/test';

/**
 * Annotation item shape matching the Grafana API response format.
 */
interface MockAnnotation {
  id: number;
  alertId?: number;
  dashboardUID: string;
  panelId: number;
  userId?: number;
  userName?: string;
  newState?: string;
  prevState?: string;
  time: number;
  timeEnd?: number;
  text: string;
  tags: string[];
  data?: Record<string, unknown>;
}

/**
 * Mocks for all annotation API endpoints.
 * Call this BEFORE navigating to a page (e.g. before gotoDashboardPage).
 * Authored by Cursor/Composer 1.5
 */
export async function setupAnnotationApiMock(page: Page): Promise<void> {
  const annotations: MockAnnotation[] = [];
  let nextId = 1;

  // Single route for all annotation API calls - ensures we catch every request
  // (avoids route ordering issues where GET pattern could match POST URL first)
  await page.route(/\/api\/annotations(\/|\?|$)/, async (route) => {
    const request = route.request();
    const url = request.url();
    const method = request.method();

    // GET /api/annotations/tags
    if (url.includes('/api/annotations/tags')) {
      if (method !== 'GET') {
        return route.continue();
      }
      const tagCounts: Record<string, number> = {};
      for (const a of annotations) {
        for (const tag of a.tags) {
          tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
        }
      }
      const tags = Object.entries(tagCounts).map(([tag, count]) => ({ tag, count }));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: { tags } }),
      });
    }

    // PUT/DELETE /api/annotations/:id
    const idMatch = url.match(/\/api\/annotations\/(\d+)(?:\?|$)/);
    if (idMatch) {
      const id = parseInt(idMatch[1], 10);
      const idx = annotations.findIndex((a) => a.id === id);

      if (method === 'PUT') {
        const body = await request.postDataJSON();
        if (idx >= 0) {
          annotations[idx] = {
            ...annotations[idx],
            time: body.time ?? annotations[idx].time,
            timeEnd: body.timeEnd ?? annotations[idx].timeEnd,
            text: body.text ?? annotations[idx].text,
            tags: Array.isArray(body.tags) ? body.tags : annotations[idx].tags,
            data: body.data ?? annotations[idx].data,
          };
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Annotation updated' }),
        });
      }
      if (method === 'DELETE') {
        if (idx >= 0) {
          annotations.splice(idx, 1);
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Annotation deleted' }),
        });
      }
    }

    // POST /api/annotations (base path only - no /tags or /:id)
    if (method === 'POST' && /\/api\/annotations\/?(?:\?|$)/.test(url) && !idMatch) {
      const body = await request.postDataJSON();
      const id = nextId++;
      const anno: MockAnnotation = {
        id,
        dashboardUID: body.dashboardUID ?? '',
        panelId: body.panelId ?? 0,
        time: body.time ?? Date.now(),
        timeEnd: body.timeEnd ?? body.time,
        text: body.text ?? '',
        tags: Array.isArray(body.tags) ? body.tags : [],
        data: body.data ?? {},
      };
      annotations.push(anno);

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Annotation added', id }),
      });
    }

    // GET /api/annotations (list)
    if (method === 'GET' && !url.includes('/api/annotations/tags')) {
      const parsed = new URL(url);
      const dashboardUID = parsed.searchParams.get('dashboardUID');
      const panelIdParam = parsed.searchParams.get('panelId');

      let filtered = annotations;
      if (dashboardUID) {
        filtered = filtered.filter((a) => a.dashboardUID === dashboardUID);
      }
      if (panelIdParam) {
        const panelId = parseInt(panelIdParam, 10);
        if (!isNaN(panelId)) {
          filtered = filtered.filter((a) => a.panelId === panelId);
        }
      }

      // Mock annotation API taking a bit
      await page.waitForTimeout(50);

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(filtered),
      });
    }

    return route.continue();
  });
}
