import { HttpResponse, http } from 'msw';
import { render, screen, userEvent } from 'test/test-utils';

import { getAPIBaseURL } from '@grafana/api-clients';
import { type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useAssistant } from '@grafana/assistant';
import { setBackendSrv } from '@grafana/runtime';
import server from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { AccessControlAction } from 'app/types/accessControl';

import { useFolderRecordingRuleCount } from '../folder-browsing/folderLookups';

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
const FOLDER_COUNTS_URL = `${getAPIBaseURL('folder.grafana.app', 'v1beta1')}/folders/:name/counts`;

/** Stands in for a Folders-mode row, so a mutation's effect on folder counts is observable. */
function FolderCountProbe() {
  const count = useFolderRecordingRuleCount('folder-uid-1');
  return <div>{`Folder holds ${count ?? 'unknown'} rules`}</div>;
}

function mockFolderCounts() {
  const state = { requests: 0, count: 3 };
  server.use(
    http.get(FOLDER_COUNTS_URL, () => {
      state.requests += 1;
      return HttpResponse.json({
        counts: [{ resource: 'recordingrules', group: 'rules.alerting.grafana.app', count: state.count }],
      });
    })
  );
  return state;
}

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

  it('REC-6: Pause patches only spec.paused on /recordingrules/{uid} and refetches the folder counts', async () => {
    let capturedBody: unknown;
    server.use(
      http.patch(`${RECORDING_RULES_URL}/rule-uid-1`, async ({ request }) => {
        capturedBody = await request.clone().json();
        return HttpResponse.json(buildRule());
      })
    );
    const counts = mockFolderCounts();

    render(
      <>
        <FolderCountProbe />
        <RecordingRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />
      </>
    );
    await screen.findByText('Folder holds 3 rules');
    counts.count = 4;
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /pause/i }));

    expect(await screen.findByText('Folder holds 4 rules')).toBeInTheDocument();
    expect(capturedBody).toEqual({ spec: { paused: true } });
  });

  it('REC-7: Delete failure preserves the row and leaves the folder counts as they were', async () => {
    server.use(
      http.delete(`${RECORDING_RULES_URL}/rule-uid-1`, () => HttpResponse.json({ message: 'boom' }, { status: 500 }))
    );
    const counts = mockFolderCounts();

    render(
      <>
        <FolderCountProbe />
        <RecordingRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />
      </>
    );
    await screen.findByText('Folder holds 3 rules');
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/unable to delete rule/i)).toBeInTheDocument();
    expect(counts.requests).toBe(1);
  });

  it('REC-7: Delete succeeds via DELETE /recordingrules/{uid} and refetches the folder counts', async () => {
    server.use(http.delete(`${RECORDING_RULES_URL}/rule-uid-1`, () => HttpResponse.json({})));
    const counts = mockFolderCounts();

    render(
      <>
        <FolderCountProbe />
        <RecordingRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />
      </>
    );
    await screen.findByText('Folder holds 3 rules');
    counts.count = 2;
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Folder holds 2 rules')).toBeInTheDocument();
  });

  it('does not show Silence or Manage enrichments, which are Alert-only', async () => {
    render(<RecordingRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />);
    await openMenu();

    expect(screen.queryByRole('menuitem', { name: /silence/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /manage enrichments/i })).not.toBeInTheDocument();
  });
});
