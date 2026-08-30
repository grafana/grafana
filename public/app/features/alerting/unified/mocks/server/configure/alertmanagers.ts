import { HttpResponse, http } from 'msw';
import { type SetupServer } from 'msw/node';

const ALERTMANAGERS_STATUS_URL = '/api/v1/ngalert/alertmanagers';

export function setupAlertmanagersStatus(server: SetupServer) {
  server.use(
    http.get(ALERTMANAGERS_STATUS_URL, () =>
      HttpResponse.json({ data: { activeAlertManagers: [], droppedAlertManagers: [] } })
    )
  );
}
