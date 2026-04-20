import { HttpResponse, http } from 'msw';

import { wellFormedTree } from '../../../../fixtures/folders';

const [_, { dashbdD }] = wellFormedTree();

export const listPreferencesHandler = (override?: ReturnType<typeof HttpResponse.json>) =>
  http.get('/apis/preferences.grafana.app/v1alpha1/namespaces/:namespace/preferences', () => {
    return (
      override ??
      HttpResponse.json({
        metadata: {},
        items: [
          {
            metadata: { name: 'user' },
            spec: {
              theme: 'light',
              timezone: 'browser',
              weekStart: 'monday',
              homeDashboardUID: dashbdD.item.uid,
              language: '',
              regionalFormat: '',
              queryHistory: { homeTab: '' },
              navbar: { bookmarkUrls: [] },
            },
          },
        ],
      })
    );
  });

export const updatePreferencesHandler = (override?: ReturnType<typeof HttpResponse.json>) =>
  http.patch('/apis/preferences.grafana.app/v1alpha1/namespaces/:namespace/preferences/:name', () => {
    return (
      override ??
      HttpResponse.json({
        metadata: { name: 'user' },
        spec: {},
      })
    );
  });
