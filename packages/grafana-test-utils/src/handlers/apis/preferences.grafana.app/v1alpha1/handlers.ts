import { HttpResponse, http, type HttpResponseResolver } from 'msw';

import { type Preferences } from '@grafana/api-clients/rtkq/preferences/v1alpha1';

import { mockUserPreferences, setMockUserPreferences } from '../../../../fixtures/preferences';

export const MERGED_PREFS_URL = '/apis/preferences.grafana.app/v1alpha1/namespaces/:namespace/preferences/merged';
const LIST_PREFS_URL = '/apis/preferences.grafana.app/v1alpha1/namespaces/:namespace/preferences';
const UPDATE_PREFS_URL = `${LIST_PREFS_URL}/:name`;

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
  http.patch(UPDATE_PREFS_URL, async ({ request }) => {
    if (override) {
      return override;
    }
    const { spec }: Preferences = await request.clone().json();
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

export const customGetUserPreferencesHandler = (resolver: HttpResponseResolver) => http.get(LIST_PREFS_URL, resolver);

export const customPatchUserPreferencesHandler = (resolver: HttpResponseResolver) =>
  http.patch(UPDATE_PREFS_URL, resolver);

export const preferencesHandlers = { listPreferencesHandler, updatePreferencesHandler, mergedPreferencesHandler };

const handlers = [listPreferencesHandler(), updatePreferencesHandler(), mergedPreferencesHandler()];

export default handlers;
