import { HttpResponse, http } from 'msw';

// TODO: Add more realistic mock plugins data
const getPluginsHandler = () => http.get('/api/plugins', () => HttpResponse.json([]));

export default [getPluginsHandler()];
