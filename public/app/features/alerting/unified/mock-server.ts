import 'whatwg-fetch';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

import { AccessControlAction } from 'app/types';

const alertingServer = setupServer(
  // TODO: Scaffold out test behaviour/configuration for search endpoint
  http.get('/api/search', () => {
    return HttpResponse.json([]);
  }),
  // TODO: Scaffold out test behaviour/configuration for user endpoint
  http.get('/api/user', () => {
    return HttpResponse.json({});
  }),
  // TODO: Scaffold out test behaviour/configuration for alert manager endpoint
  http.get('/api/v1/ngalert', () => {
    return HttpResponse.json({ alertmanagersChoice: 'all', numExternalAlertmanagers: 1 });
  }),

  http.get('/api/folders/:folderUid', () => {
    return HttpResponse.json({
      accessControl: { [AccessControlAction.AlertingRuleUpdate]: true },
    });
  }),
  http.get('/api/prometheus/grafana/api/v1/rules', () => {
    return HttpResponse.json([]);
  }),
  http.get('/api/ruler/grafana/api/v1/rules', () => {
    return HttpResponse.json([]);
  }),
  http.post('/api/ruler/grafana/api/v1/rules/:namespaceUID/', async ({ request }) => {
    console.log('updaint');
    const body = await request.json();
    console.log(JSON.stringify(body, null, 2));
    return HttpResponse.json({
      message: 'rule group updated successfully',
      updated: ['foo', 'bar', 'baz'],
    });
  })
);

export default alertingServer;
