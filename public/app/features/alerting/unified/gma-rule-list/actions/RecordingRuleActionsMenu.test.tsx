import { HttpResponse, http } from 'msw';
import { render, screen, userEvent, waitFor } from 'test/test-utils';

import { getAPIBaseURL } from '@grafana/api-clients';
import { type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useAssistant } from '@grafana/assistant';
import { setBackendSrv } from '@grafana/runtime';
import server from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { AccessControlAction } from 'app/types/accessControl';

import { RecordingRuleActionsMenu } from './RecordingRuleActionsMenu';

jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(),
  createAssistantContextItem: jest.fn((type: string, data: object) => ({ type, ...data })),
}));
jest.mocked(useAssistant).mockReturnValue({
  isLoading: false,
  isAvailable: false,
  openAssistant: jest.fn(),
} as unknown as ReturnType<typeof useAssistant>);

const RECORDING_RULES_URL = `${getAPIBaseURL('rules.alerting.grafana.app', 'v0alpha1')}/recordingrules`;

function buildRule(): RecordingRule {
  return {
    apiVersion: 'v0alpha1',
    kind: 'RecordingRule',
    metadata: {
      name: 'rule-uid-1',
      annotations: {
        'grafana.app/folder': 'folder-uid-1',
        'grafana.com/access/canWrite': 'true',
        'grafana.com/access/canDelete': 'true',
      },
    },
    spec: {
      title: 'CPU usage average',
      metric: 'cpu_usage:avg',
      targetDatasourceUID: 'prometheus-uid',
      trigger: { interval: '1m' },
      expressions: {},
    },
  };
}

setBackendSrv(backendSrv);
setupMswServer();

async function openMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /more/i }));
  return user;
}

describe('RecordingRuleActionsMenu', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate]);
    server.use(http.patch(`${RECORDING_RULES_URL}/rule-uid-1`, () => HttpResponse.json(buildRule())));
  });

  it('REC-6: Pause patches only spec.paused on /recordingrules/{uid} and calls onMutated', async () => {
    let capturedBody: unknown;
    server.use(
      http.patch(`${RECORDING_RULES_URL}/rule-uid-1`, async ({ request }) => {
        capturedBody = await request.clone().json();
        return HttpResponse.json(buildRule());
      })
    );
    const onMutated = jest.fn();

    render(
      <RecordingRuleActionsMenu
        ruleUid="rule-uid-1"
        resourceState={{ status: 'loaded', rule: buildRule() }}
        onMutated={onMutated}
      />
    );
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /pause/i }));

    await waitFor(() => expect(onMutated).toHaveBeenCalledWith('paused'));
    expect(capturedBody).toEqual({ spec: { paused: true } });
  });

  it('REC-7: Delete failure preserves the row and does not call onMutated', async () => {
    server.use(
      http.delete(`${RECORDING_RULES_URL}/rule-uid-1`, () => HttpResponse.json({ message: 'boom' }, { status: 500 }))
    );
    const onMutated = jest.fn();

    render(
      <RecordingRuleActionsMenu
        ruleUid="rule-uid-1"
        resourceState={{ status: 'loaded', rule: buildRule() }}
        onMutated={onMutated}
      />
    );
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/unable to delete rule/i)).toBeInTheDocument();
    expect(onMutated).not.toHaveBeenCalled();
  });

  it('REC-7: Delete succeeds via DELETE /recordingrules/{uid} and calls onMutated', async () => {
    server.use(http.delete(`${RECORDING_RULES_URL}/rule-uid-1`, () => HttpResponse.json({})));
    const onMutated = jest.fn();

    render(
      <RecordingRuleActionsMenu
        ruleUid="rule-uid-1"
        resourceState={{ status: 'loaded', rule: buildRule() }}
        onMutated={onMutated}
      />
    );
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onMutated).toHaveBeenCalledWith('deleted'));
  });

  it('does not show Silence or Manage enrichments, which are Alert-only', async () => {
    render(
      <RecordingRuleActionsMenu
        ruleUid="rule-uid-1"
        resourceState={{ status: 'loaded', rule: buildRule() }}
        onMutated={jest.fn()}
      />
    );
    await openMenu();

    expect(screen.queryByRole('menuitem', { name: /silence/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /manage enrichments/i })).not.toBeInTheDocument();
  });
});
