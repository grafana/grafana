import { HttpResponse, http } from 'msw';
import { render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { getAPIBaseURL } from '@grafana/api-clients';
import { type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useAssistant } from '@grafana/assistant';
import { locationService, setBackendSrv } from '@grafana/runtime';
import server from '@grafana/test-utils/server';
import { appEvents } from 'app/core/app_events';
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
  return <div>{`Folder holds ${count.status === 'loaded' ? count.count : 'unknown'} rules`}</div>;
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

const WRITABLE_ANNOTATIONS = {
  'grafana.app/folder': 'folder-uid-1',
  'grafana.com/access/canWrite': 'true',
  'grafana.com/access/canDelete': 'true',
};
const PROVISIONED_ANNOTATIONS = { ...WRITABLE_ANNOTATIONS, 'grafana.com/provenance': 'api' };

function buildRule({
  annotations = WRITABLE_ANNOTATIONS,
  labels,
}: { annotations?: Record<string, string>; labels?: Record<string, string> } = {}): RecordingRule {
  return {
    apiVersion: 'v0alpha1',
    kind: 'RecordingRule',
    metadata: { name: 'rule-uid-1', annotations },
    spec: {
      labels,
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

function renderLoaded(rule = buildRule(), options?: Parameters<typeof render>[1]) {
  return render(<RecordingRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule }} />, options);
}

function renderWithFolderCountProbe() {
  return render(
    <>
      <FolderCountProbe />
      <RecordingRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />
    </>
  );
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

    renderWithFolderCountProbe();
    await screen.findByText('Folder holds 3 rules');
    counts.count = 4;
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /pause/i }));

    expect(await screen.findByText('Folder holds 4 rules')).toBeInTheDocument();
    expect(capturedBody).toEqual({ spec: { paused: true } });
  });

  it('reports Copy link failure when the clipboard write rejects', async () => {
    const emitSpy = jest.spyOn(appEvents, 'emit');

    renderLoaded();
    const user = await openMenu();
    jest.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    await user.click(screen.getByRole('menuitem', { name: /copy link/i }));

    await waitFor(() => expect(emitSpy).toHaveBeenCalledWith('alert-error', ['Could not copy URL to clipboard']));
  });

  it('reports Copy link failure when the clipboard is unavailable', async () => {
    const emitSpy = jest.spyOn(appEvents, 'emit');

    renderLoaded();
    const user = await openMenu();
    const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    try {
      await user.click(screen.getByRole('menuitem', { name: /copy link/i }));

      await waitFor(() => expect(emitSpy).toHaveBeenCalledWith('alert-error', ['Could not copy URL to clipboard']));
    } finally {
      if (clipboard) {
        Object.defineProperty(navigator, 'clipboard', clipboard);
      }
    }
  });

  it('REC-7: Delete failure preserves the row and leaves the folder counts as they were', async () => {
    server.use(
      http.delete(`${RECORDING_RULES_URL}/rule-uid-1`, () => HttpResponse.json({ message: 'boom' }, { status: 500 }))
    );
    const counts = mockFolderCounts();

    renderWithFolderCountProbe();
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

    renderWithFolderCountProbe();
    await screen.findByText('Folder holds 3 rules');
    counts.count = 2;
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Folder holds 2 rules')).toBeInTheDocument();
  });

  describe('unavailable actions show their reason', () => {
    function isDisabled(element: HTMLElement) {
      return element.getAttribute('aria-disabled') === 'true' || element.hasAttribute('disabled');
    }

    it('ACC-7: opens from the keyboard and arrow navigation skips the disabled actions', async () => {
      const user = userEvent.setup();
      render(<RecordingRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loading' }} />);

      screen.getByRole('button', { name: 'More' }).focus();
      await user.keyboard('{Enter}');
      await user.keyboard('{ArrowDown}');

      expect(screen.getByRole('menuitem', { name: 'Copy link' })).toHaveFocus();
    });

    it.each([
      {
        name: 'the full rule is loading',
        state: { status: 'loading' } as const,
        reason: 'Checking permissions...',
        duplicateDisabled: true,
      },
      {
        name: 'the full rule failed to load',
        state: { status: 'error' } as const,
        reason: 'Permission unknown',
        duplicateDisabled: true,
      },
      {
        name: 'the capability annotations are missing',
        state: { status: 'loaded', rule: buildRule({ annotations: {} }) } as const,
        reason: 'Permission unknown',
        duplicateDisabled: false,
      },
      {
        name: 'the capabilities are false',
        state: {
          status: 'loaded',
          rule: buildRule({
            annotations: {
              ...WRITABLE_ANNOTATIONS,
              'grafana.com/access/canWrite': 'false',
              'grafana.com/access/canDelete': 'false',
            },
          }),
        } as const,
        reason: 'You do not have permission to do this',
        duplicateDisabled: false,
      },
      {
        name: 'the rule is provisioned',
        state: {
          status: 'loaded',
          rule: buildRule({ annotations: { ...WRITABLE_ANNOTATIONS, 'grafana.com/provenance': 'api' } }),
        } as const,
        reason: 'Provisioned',
        duplicateDisabled: false,
      },
      {
        name: 'the rule is both provisioned and managed by Terraform',
        state: {
          status: 'loaded',
          rule: buildRule({
            annotations: {
              ...WRITABLE_ANNOTATIONS,
              'grafana.com/provenance': 'api',
              'grafana.app/managedBy': 'terraform',
            },
          }),
        } as const,
        reason: 'Managed by Terraform',
        duplicateDisabled: false,
      },
      {
        name: 'the origin label starts with plugin/',
        state: { status: 'loaded', rule: buildRule({ labels: { __grafana_origin: 'plugin/my-app' } }) } as const,
        reason: 'This rule is managed by a plugin and cannot be edited through the UI',
        duplicateDisabled: true,
      },
    ])('ACT: disables Pause and Delete with their reason when $name', async ({ state, reason, duplicateDisabled }) => {
      render(<RecordingRuleActionsMenu ruleUid="rule-uid-1" resourceState={state} />);
      const user = await openMenu();

      for (const name of ['Pause', 'Delete']) {
        // ACC-7: the reason is part of the disabled item's accessible name, not only a hover tooltip.
        const item = screen.getByRole('menuitem', { name: `${name}: ${reason}` });
        expect(isDisabled(item)).toBe(true);
        await user.hover(item);
        expect(await screen.findByText(reason)).toBeInTheDocument();
        await user.unhover(item);
      }
      expect(isDisabled(screen.getByRole('menuitem', { name: /^Duplicate/ }))).toBe(duplicateDisabled);
    });

    it('does not restrict a rule whose origin label is not a plugin', async () => {
      const rule = buildRule({ labels: { __grafana_origin: 'my-script' } });
      renderLoaded(rule);
      await openMenu();

      for (const name of ['Pause', 'Delete', 'Duplicate']) {
        expect(isDisabled(screen.getByRole('menuitem', { name }))).toBe(false);
      }
    });
  });

  it('REC-5: Duplicate is a plain link to the recording copy route with no returnTo', async () => {
    renderLoaded();
    await openMenu();

    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toHaveAttribute(
      'href',
      '/alerting/new/grafana-recording?copyFrom=rule-uid-1'
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('REC-5: Duplicate of a provisioned or managed rule confirms first', () => {
    const MANAGED_ANNOTATIONS = { ...WRITABLE_ANNOTATIONS, 'grafana.app/managedBy': 'terraform' };

    const LIST_ENTRY = { historyOptions: { initialEntries: ['/alerting/rules/recording'] } };

    it.each([
      ['provisioned', PROVISIONED_ANNOTATIONS],
      ['managed', MANAGED_ANNOTATIONS],
    ])('asks before copying a %s rule and navigates to the copy route on Copy', async (_kind, annotations) => {
      renderLoaded(buildRule({ annotations }), LIST_ENTRY);
      const user = await openMenu();
      const item = screen.getByRole('menuitem', { name: 'Duplicate' });
      expect(item).not.toHaveAttribute('href');
      await user.click(item);

      const dialog = await screen.findByRole('dialog', { name: 'Copy provisioned recording rule' });
      expect(dialog).toHaveTextContent('The new rule will not be marked as a provisioned rule.');
      expect(dialog).toHaveTextContent(
        'You will need to set a new evaluation group for the copied rule because the original one has been provisioned and cannot be used for rules created in the UI.'
      );
      expect(locationService.getLocation().pathname).toBe('/alerting/rules/recording');

      await user.click(within(dialog).getByRole('button', { name: 'Copy' }));

      expect(locationService.getLocation().pathname).toBe('/alerting/new/grafana-recording');
      expect(locationService.getLocation().search).toBe('?copyFrom=rule-uid-1');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('stays on the list when the confirmation is cancelled', async () => {
      renderLoaded(buildRule({ annotations: PROVISIONED_ANNOTATIONS }), LIST_ENTRY);
      const user = await openMenu();
      await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
      const dialog = await screen.findByRole('dialog', { name: 'Copy provisioned recording rule' });

      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(locationService.getLocation().pathname).toBe('/alerting/rules/recording');
    });
  });

  it('does not show Silence or Manage enrichments, which are Alert-only', async () => {
    renderLoaded();
    await openMenu();

    expect(screen.queryByRole('menuitem', { name: /silence/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /manage enrichments/i })).not.toBeInTheDocument();
  });

  describe('REC-8: Analyze sends the full Recording rule without inventing Alert state or routing', () => {
    function mockAssistant(isAvailable: boolean) {
      const openAssistant = jest.fn();
      jest.mocked(useAssistant).mockReturnValue({
        isLoading: false,
        isAvailable,
        openAssistant,
      } as unknown as ReturnType<typeof useAssistant>);
      return openAssistant;
    }

    afterEach(() => {
      mockAssistant(false);
    });

    it('hides Analyze when the Assistant is unavailable', async () => {
      mockAssistant(false);
      renderLoaded();
      await openMenu();

      expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Analyze rule' })).not.toBeInTheDocument();
    });

    it('hides Analyze while the full rule is not loaded, even when the Assistant is available', async () => {
      mockAssistant(true);
      render(<RecordingRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loading' }} />);
      await openMenu();

      expect(screen.getByRole('menuitem', { name: /^Delete/ })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Analyze rule' })).not.toBeInTheDocument();
    });

    it('shows Analyze when the Assistant is available', async () => {
      mockAssistant(true);
      renderLoaded();
      await openMenu();

      expect(screen.getByRole('menuitem', { name: 'Analyze rule' })).toBeInTheDocument();
    });

    it('opens the Assistant with the loaded rule definition and no alert state, instances or routing', async () => {
      const openAssistant = mockAssistant(true);
      const rule = buildRule({ labels: { team: 'infra' } });
      rule.spec.expressions = { A: { model: { expr: 'avg(cpu)' } } as RecordingRule['spec']['expressions'][string] };
      renderLoaded(rule);
      const user = await openMenu();

      await user.click(screen.getByRole('menuitem', { name: 'Analyze rule' }));

      expect(openAssistant).toHaveBeenCalledTimes(1);
      const [{ prompt, context, origin, autoSend }] = openAssistant.mock.calls[0];
      expect(origin).toBe('alerting/analyze-rule-menu-item');
      expect(autoSend).toBe(true);
      expect(prompt).toBe(
        'Analyze the recording rule "CPU usage average (uid: rule-uid-1)", which records its query result as the metric "cpu_usage:avg" on data source "prometheus-uid". Labels: team="infra".'
      );
      expect(context).toEqual([
        {
          type: 'structured',
          title: 'Recording: CPU usage average',
          data: {
            rule: {
              name: 'rule-uid-1',
              title: 'CPU usage average',
              labels: { team: 'infra' },
              expressions: { A: { model: { expr: 'avg(cpu)' } } },
              metric: 'cpu_usage:avg',
              targetDatasourceUID: 'prometheus-uid',
            },
          },
        },
      ]);
    });

    it('keeps server-reported status out of the Assistant payload', async () => {
      const openAssistant = mockAssistant(true);
      const rule = buildRule();
      rule.status = {
        health: 'Recording',
        lastError: 'boom',
        lastEvaluationTime: '2026-01-01T00:00:00Z',
      };
      renderLoaded(rule);
      const user = await openMenu();

      await user.click(screen.getByRole('menuitem', { name: 'Analyze rule' }));

      const [{ prompt, context }] = openAssistant.mock.calls[0];
      expect(Object.keys(context[0].data.rule).sort()).toEqual([
        'expressions',
        'labels',
        'metric',
        'name',
        'targetDatasourceUID',
        'title',
      ]);
      expect(prompt).not.toMatch(/firing|state|instance|routing|notification|contact point|boom/i);
    });
  });
});
