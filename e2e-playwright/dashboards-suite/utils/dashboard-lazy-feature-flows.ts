import { randomUUID } from 'crypto';

import { test as base, expect } from '@grafana/plugin-e2e';

export const test = base.extend<{ dashboardUid: string }>({
  dashboardUid: async ({ request }, provide) => {
    const uid = `lazy-${randomUUID().slice(0, 8)}`;
    const response = await request.post('/api/dashboards/db', {
      data: {
        dashboard: {
          uid,
          title: 'Lazy loading verification',
          schemaVersion: 39,
          editable: true,
          time: { from: 'now-1h', to: 'now' },
          annotations: { list: [] },
          templating: { list: [] },
          links: [],
          panels: [
            {
              id: 1,
              title: 'Expression result',
              type: 'stat',
              gridPos: { x: 0, y: 0, w: 12, h: 8 },
              datasource: { type: '__expr__', uid: '__expr__' },
              targets: [
                { refId: 'A', type: 'math', expression: '2 + 3', datasource: { type: '__expr__', uid: '__expr__' } },
              ],
              fieldConfig: { defaults: {}, overrides: [] },
              options: { reduceOptions: { calcs: ['lastNotNull'], values: false } },
            },
            {
              id: 3,
              title: 'Action table',
              type: 'table',
              gridPos: { x: 0, y: 8, w: 12, h: 8 },
              datasource: { type: '__expr__', uid: '__expr__' },
              targets: [
                { refId: 'A', type: 'math', expression: '2 + 3', datasource: { type: '__expr__', uid: '__expr__' } },
              ],
              fieldConfig: { defaults: {}, overrides: [] },
              options: {},
            },
            {
              id: 2,
              title: 'Canvas background',
              type: 'canvas',
              gridPos: { x: 12, y: 0, w: 12, h: 8 },
              targets: [],
              fieldConfig: { defaults: {}, overrides: [] },
              options: {
                inlineEditing: true,
                root: {
                  name: 'Element',
                  type: 'frame',
                  elements: [],
                  background: { color: { fixed: 'transparent' } },
                  placement: { width: 100, height: 100 },
                },
              },
            },
          ],
        },
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    try {
      await provide(uid);
    } finally {
      await request.delete(`/api/dashboards/uid/${uid}`);
    }
  },
});
