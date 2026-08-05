import { HttpResponse, http } from 'msw';
import { type SetupServer } from 'msw/node';

import {
  AlertmanagerChoice,
  type GrafanaAlertingConfiguration,
  type PostableGrafanaAlertingConfiguration,
} from 'app/plugins/datasource/alertmanager/types';

const ADMIN_CONFIG_URL = '/api/v1/ngalert/admin_config';
const ALERTMANAGERS_STATUS_URL = '/api/v1/ngalert/alertmanagers';

export interface AdminConfigPostState {
  lastPayload: PostableGrafanaAlertingConfiguration | null;
}

export function setupAdminConfigGet(server: SetupServer, body: GrafanaAlertingConfiguration | null) {
  server.use(
    http.get(ADMIN_CONFIG_URL, () => {
      if (body === null) {
        return new HttpResponse(null, { status: 404 });
      }
      return HttpResponse.json(body);
    })
  );
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

/**
 * Stateful admin_config handlers: POST writes to a ref, GET reads from it so a refetch after
 * RTKQ tag invalidation sees the persisted UID without a manual handler swap.
 */
export function setupStatefulAdminConfig(
  server: SetupServer,
  state: AdminConfigPostState,
  initial: GrafanaAlertingConfiguration = { alertmanagersChoice: AlertmanagerChoice.Internal }
) {
  let stored: PostableGrafanaAlertingConfiguration = { ...initial };
  server.use(
    http.get(ADMIN_CONFIG_URL, () => HttpResponse.json(stored)),
    http.post(ADMIN_CONFIG_URL, async ({ request }) => {
      const body = (await request.json()) as PostableGrafanaAlertingConfiguration;
      state.lastPayload = body;
      stored = { ...stored, ...body };
      return HttpResponse.json({ message: 'ok' });
    })
  );
}

export function setupAlertmanagersStatus(server: SetupServer) {
  server.use(
    http.get(ALERTMANAGERS_STATUS_URL, () =>
      HttpResponse.json({ data: { activeAlertManagers: [], droppedAlertManagers: [] } })
    )
  );
}
