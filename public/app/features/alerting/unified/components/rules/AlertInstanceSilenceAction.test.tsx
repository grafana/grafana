import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { type SilenceCreatePayload } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';
import { GrafanaAlertState } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockGrafanaPromAlertingRule, mockPromAlert } from '../../mocks';
import { setFolderAccessControl } from '../../mocks/server/configure';

import { AlertInstanceSilenceAction } from './AlertInstanceSilenceAction';

const RULE_UID = 'rule-uid-1';
const rule = mockGrafanaPromAlertingRule({ uid: RULE_UID });
const instance = mockPromAlert({
  state: GrafanaAlertState.Alerting,
  labels: { alertname: 'CPU high', instance: 'server-1' },
});
const server = setupMswServer();
const findSilenceButton = () => screen.findByRole('button', { name: /^silence$/i });

let mainView: HTMLDivElement;

beforeEach(() => {
  grantUserPermissions([AccessControlAction.AlertingInstanceCreate]);
  setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: false });
  contextSrv.user.isSignedIn = true;
  contextSrv.user.name = 'admin';

  mainView = document.createElement('div');
  mainView.classList.add('main-view');
  document.body.appendChild(mainView);
});

afterEach(() => {
  document.body.removeChild(mainView);
});

describe('AlertInstanceSilenceAction', () => {
  it('hides the action when silence permission is revoked', async () => {
    const { rerender } = render(<AlertInstanceSilenceAction rule={rule} instance={instance} />);
    expect(await findSilenceButton()).toBeInTheDocument();

    grantUserPermissions([]);
    rerender(<AlertInstanceSilenceAction rule={rule} instance={instance} />);

    expect(screen.queryByRole('button', { name: /^silence$/i })).not.toBeInTheDocument();
  });

  it('opens the instance silence drawer and closes it after saving the scoped matchers', async () => {
    const payloads: SilenceCreatePayload[] = [];
    server.use(
      http.post('/api/alertmanager/grafana/api/v2/silences', async ({ request }) => {
        payloads.push((await request.json()) as SilenceCreatePayload);
        return HttpResponse.json({ silenceId: '4bda5b38-7939-4887-9ec2-16323b8e3b4e' });
      })
    );
    const { user } = render(<AlertInstanceSilenceAction rule={rule} instance={instance} />);

    await user.click(await findSilenceButton());
    expect(await screen.findByRole('dialog', { name: 'Silence alert instance' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save silence/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(payloads).toHaveLength(1);
    expect(payloads[0].matchers).toEqual([
      { isEqual: true, isRegex: false, name: 'alertname', value: 'CPU high' },
      { isEqual: true, isRegex: false, name: 'instance', value: 'server-1' },
      { isEqual: true, isRegex: false, name: '__alert_rule_uid__', value: RULE_UID },
    ]);
  });

  it('closes the drawer on cancel without navigating', async () => {
    const { user } = render(<AlertInstanceSilenceAction rule={rule} instance={instance} />);
    const locationBefore = locationService.getLocation();

    await user.click(await findSilenceButton());
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByText(/^cancel$/i));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(locationService.getLocation()).toEqual(locationBefore);
  });
});
