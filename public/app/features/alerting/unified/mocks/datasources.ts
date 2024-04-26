import { HttpResponse, http } from 'msw';

// TODO: Add more accurate endpoint responses as tests require
export const datasourceBuildInfoHandler = () =>
  http.get('/api/datasources/proxy/uid/:datasourceUid/api/v1/status/buildinfo', () => HttpResponse.json({}));
