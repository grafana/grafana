import { HttpResponse, http, type HttpResponseResolver } from 'msw';

import { type PreferencesSpec } from '@grafana/api-clients/rtkq/preferences/v1alpha1';

import { mockUserPreferences, setMockUserPreferences } from '../../../../fixtures/preferences';

export const MERGED_PREFS_URL = '/apis/preferences.grafana.app/v1alpha1/namespaces/:namespace/preferences/merged';
const LIST_PREFS_URL = '/apis/preferences.grafana.app/v1alpha1/namespaces/:namespace/preferences';

// The list and patch handlers share the `mockUserPreferences` fixture so PATCHed updates survive
// the refetch that cache invalidation triggers (reset between tests by resetFixtures()).
const listPreferencesHandler = (override?: ReturnType<typeof HttpResponse.json>) =>
  http.get(LIST_PREFS_URL, () => {
    return (
      override ??
      HttpResponse.json({
        metadata: {},
        items: [
          {
            metadata: { name: 'user' },
            spec: mockUserPreferences,
          },
        ],
      })
    );
  });

const updatePreferencesHandler = (override?: ReturnType<typeof HttpResponse.json>) =>
  http.patch('/apis/preferences.grafana.app/v1alpha1/namespaces/:namespace/preferences/:name', async ({ request }) => {
    if (override) {
      return override;
    }
    // Merge the patched spec into the stored preferences so a subsequent GET reflects it. Callers
    // send whole sub-objects (e.g. `navbar`), so a shallow merge replaces them correctly.
    // Clone so tests capturing requests can still read the original body.
    const { spec } = (await request.clone().json()) as { spec: Partial<PreferencesSpec> };
    setMockUserPreferences(spec);
    return HttpResponse.json({
      metadata: { name: 'user' },
      spec: mockUserPreferences,
    });
  });

const mergedPreferencesHandler = (override?: ReturnType<typeof HttpResponse.json>) =>
  http.get(MERGED_PREFS_URL, () => {
    return (
      override ??
      HttpResponse.json({
        metadata: {},
        spec: mockUserPreferences,
      })
    );
  });

// Override the list (GET) in a test — e.g. to simulate a pending/slow or failing request.
export const customGetUserPreferencesHandler = (resolver: HttpResponseResolver) => http.get(LIST_PREFS_URL, resolver);

export const preferencesHandlers = { listPreferencesHandler, updatePreferencesHandler, mergedPreferencesHandler };

const handlers = [listPreferencesHandler(), updatePreferencesHandler(), mergedPreferencesHandler()];

export default handlers;
