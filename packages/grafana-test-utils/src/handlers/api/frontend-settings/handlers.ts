import { HttpResponse, http } from 'msw';

const getFrontendSettingsHandler = () =>
  http.get('/api/frontend/settings', () => HttpResponse.json({ datasources: {}, defaultDatasource: '' }));

export default [getFrontendSettingsHandler()];
