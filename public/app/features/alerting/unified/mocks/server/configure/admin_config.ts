import { HttpResponse, http } from 'msw';
import { type SetupServer } from 'msw/node';

import { type PostableGrafanaAlertingConfiguration } from 'app/plugins/datasource/alertmanager/types';

const ADMIN_CONFIG_URL = '/api/v1/ngalert/admin_config';

export interface AdminConfigPostState {
  lastPayload: PostableGrafanaAlertingConfiguration | null;
}

export function setupAdminConfigPost(
  server: SetupServer,
  state: AdminConfigPostState,
  status: number,
  body: object = { message: 'ok' }
) {
  server.use(
    http.post(ADMIN_CONFIG_URL, async ({ request }) => {
      state.lastPayload = (await request.json()) as PostableGrafanaAlertingConfiguration;
      return HttpResponse.json(body, { status });
    })
  );
}
