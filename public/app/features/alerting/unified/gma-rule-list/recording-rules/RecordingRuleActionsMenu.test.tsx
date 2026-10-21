import { HttpResponse, http } from 'msw';
import { render, screen, type userEvent, within } from 'test/test-utils';

import { type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useAssistant } from '@grafana/assistant';
import { locationService, setBackendSrv } from '@grafana/runtime';
import server from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { AccessControlAction } from 'app/types/accessControl';

import { useFolderRecordingRuleCount } from '../folder-browsing/folderLookups';
import { FAILED_RULE, LOADING_RULE, buildRecordingRule, loadedRule } from '../mocks/factories';
import { FOLDER_COUNTS_URL, rulesUrl } from '../mocks/handlers';

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

const RECORDING_RULES_URL = rulesUrl('recording');

/** Stands in for a Folders-mode row so folder counts are observable. */
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

function buildRule({
  annotations = WRITABLE_ANNOTATIONS,
  labels,
}: { annotations?: Record<string, string>; labels?: Record<string, string> } = {}) {
  return buildRecordingRule({ annotations, labels, title: 'CPU usage average' });
}

setBackendSrv(backendSrv);
setupMswServer();

function renderLoaded(rule = buildRule()) {
  return render(<RecordingRuleActionsMenu ruleUid="rule-uid-1" resourceState={loadedRule(rule)} />);
}

function renderWithFolderCountProbe() {
  return render(
    <>
      <FolderCountProbe />
      <RecordingRuleActionsMenu ruleUid="rule-uid-1" resourceState={loadedRule(buildRule())} />
    </>
  );
}

function isDisabled(element: HTMLElement) {
  return element.getAttribute('aria-disabled') === 'true' || element.hasAttribute('disabled');
}

type User = ReturnType<typeof userEvent.setup>;

async function openMenu(user: User) {
  await user.click(screen.getByRole('button', { name: /more/i }));
}

describe('RecordingRuleActionsMenu', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate]);
    server.use(http.patch(`${RECORDING_RULES_URL}/rule-uid-1`, () => HttpResponse.json(buildRule())));
  });

  it('Pause patches only spec.paused on /recordingrules/{uid} and refetches the folder counts', async () => {
    let capturedBody: unknown;
    server.use(
      http.patch(`${RECORDING_RULES_URL}/rule-uid-1`, async ({ request }) => {
        capturedBody = await request.clone().json();
        return HttpResponse.json(buildRule());
      })
    );
    const counts = mockFolderCounts();

    const { user } = renderWithFolderCountProbe();
    await screen.findByText('Folder holds 3 rules');
    counts.count = 4;
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /pause/i }));

    expect(await screen.findByText('Folder holds 4 rules')).toBeInTheDocument();
    expect(capturedBody).toEqual({ spec: { paused: true } });
  });

  it('Delete failure preserves the row and leaves the folder counts as they were', async () => {
    server.use(
      http.delete(`${RECORDING_RULES_URL}/rule-uid-1`, () => HttpResponse.json({ message: 'boom' }, { status: 500 }))
    );
    const counts = mockFolderCounts();

    const { user } = renderWithFolderCountProbe();
    await screen.findByText('Folder holds 3 rules');
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/unable to delete rule/i)).toBeInTheDocument();
    expect(counts.requests).toBe(1);
  });

  it('Delete succeeds via DELETE /recordingrules/{uid} and refetches the folder counts', async () => {
    server.use(http.delete(`${RECORDING_RULES_URL}/rule-uid-1`, () => HttpResponse.json({})));
    const counts = mockFolderCounts();

    const { user } = renderWithFolderCountProbe();
    await screen.findByText('Folder holds 3 rules');
    counts.count = 2;
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Folder holds 2 rules')).toBeInTheDocument();
  });

  describe('unavailable actions', () => {
    it('opens from the keyboard and arrow navigation skips the disabled actions', async () => {
      const { user } = render(<RecordingRuleActionsMenu ruleUid="rule-uid-1" resourceState={LOADING_RULE} />);

      screen.getByRole('button', { name: 'More' }).focus();
      await user.keyboard('{Enter}');
      await user.keyboard('{ArrowDown}');

      expect(screen.getByRole('menuitem', { name: 'Copy link' })).toHaveFocus();
    });

    it('shows every action disabled as checking while the full rule is loading', async () => {
      const { user } = render(<RecordingRuleActionsMenu ruleUid="rule-uid-1" resourceState={LOADING_RULE} />);
      await openMenu(user);

      for (const name of ['Pause', 'Delete', 'Duplicate']) {
        // The reason is part of the disabled item's accessible name, not only a hover tooltip.
        const item = screen.getByRole('menuitem', { name: `${name}: Checking permissions...` });
        expect(isDisabled(item)).toBe(true);
        await user.hover(item);
        expect(await screen.findByText('Checking permissions...')).toBeInTheDocument();
        await user.unhover(item);
      }
      expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeEnabled();
    });

    it.each([
      { name: 'the full rule failed to load', state: FAILED_RULE, duplicateShown: false },
      {
        name: 'the rule is provisioned',
        state: loadedRule(buildRule({ annotations: { ...WRITABLE_ANNOTATIONS, 'grafana.com/provenance': 'api' } })),
        duplicateShown: true,
      },
    ])('leaves Pause and Delete out of the menu when $name', async ({ state, duplicateShown }) => {
      const { user } = render(<RecordingRuleActionsMenu ruleUid="rule-uid-1" resourceState={state} />);
      await openMenu(user);

      expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /^(Pause|Resume)/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /^Delete/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /^Duplicate/ }) !== null).toBe(duplicateShown);
    });

    it('leaves Duplicate out when the user cannot create rules', async () => {
      grantUserPermissions([]);
      const { user } = renderLoaded();
      await openMenu(user);

      expect(screen.getByRole('menuitem', { name: 'Pause' })).toBeEnabled();
      expect(screen.queryByRole('menuitem', { name: /^Duplicate/ })).not.toBeInTheDocument();
    });
  });

  it('Duplicate is a plain link to the recording copy route with no returnTo', async () => {
    const { user } = renderLoaded();
    await openMenu(user);

    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toHaveAttribute(
      'href',
      '/alerting/new/grafana-recording?copyFrom=rule-uid-1'
    );
  });

  it('Duplicate of a provisioned rule asks first, then navigates to the copy route on Copy', async () => {
    const { user } = render(
      <RecordingRuleActionsMenu
        ruleUid="rule-uid-1"
        resourceState={loadedRule(
          buildRule({ annotations: { ...WRITABLE_ANNOTATIONS, 'grafana.com/provenance': 'api' } })
        )}
      />,
      { historyOptions: { initialEntries: ['/alerting/rules/recording'] } }
    );
    await openMenu(user);
    const item = screen.getByRole('menuitem', { name: 'Duplicate' });
    expect(item).not.toHaveAttribute('href');
    await user.click(item);

    const dialog = await screen.findByRole('dialog', { name: 'Copy provisioned recording rule' });
    expect(locationService.getLocation().pathname).toBe('/alerting/rules/recording');

    await user.click(within(dialog).getByRole('button', { name: 'Copy' }));

    expect(locationService.getLocation().pathname).toBe('/alerting/new/grafana-recording');
    expect(locationService.getLocation().search).toBe('?copyFrom=rule-uid-1');
  });

  it('does not show Silence or Manage enrichments, which are Alert-only', async () => {
    const { user } = renderLoaded();
    await openMenu(user);

    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /silence/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /manage enrichments/i })).not.toBeInTheDocument();
  });

  describe('Analyze sends the full Recording rule without inventing Alert state or routing', () => {
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

    it('opens the Assistant with the loaded rule definition and no alert state, instances or routing', async () => {
      const openAssistant = mockAssistant(true);
      const rule = buildRule({ labels: { team: 'infra' } });
      rule.spec.expressions = { A: { model: { expr: 'avg(cpu)' } } as RecordingRule['spec']['expressions'][string] };
      const { user } = renderLoaded(rule);
      await openMenu(user);

      await user.click(screen.getByRole('menuitem', { name: 'Analyze rule' }));

      expect(openAssistant).toHaveBeenCalledTimes(1);
      const [{ prompt, context, origin, autoSend }] = openAssistant.mock.calls[0];
      expect(origin).toBe('alerting/analyze-rule-menu-item');
      expect(autoSend).toBe(true);
      expect(prompt).toBe(
        'Analyze the recording rule "CPU usage average (uid: rule-uid-1)", which records its query result as the metric "cpu_usage:avg" on data source "prom-1". Labels: team="infra".'
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
              targetDatasourceUID: 'prom-1',
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
      const { user } = renderLoaded(rule);
      await openMenu(user);

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
