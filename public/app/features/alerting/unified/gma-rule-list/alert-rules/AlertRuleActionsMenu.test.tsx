import { HttpResponse, http } from 'msw';
import { render, screen, testWithFeatureToggles, userEvent, waitFor, within } from 'test/test-utils';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useAssistant } from '@grafana/assistant';
import { OrgRole } from '@grafana/data';
import { locationService, setBackendSrv } from '@grafana/runtime';
import server from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { addEnrichmentDrawerExtension } from 'app/features/alerting/unified/components/rule-list/extensions/EnrichmentDrawerExtension';
import { mockFolderApi, setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions, mockFolder } from 'app/features/alerting/unified/mocks';
import { captureRequests } from 'app/features/alerting/unified/mocks/server/events';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { useFolderAlertRuleCount } from '../folder-browsing/folderLookups';
import { FAILED_RULE, LOADING_RULE, buildAlertRule as buildRuleWith, loadedRule } from '../mocks/factories';
import { FOLDER_COUNTS_URL, rulesUrl } from '../mocks/handlers';

import { AlertRuleActionsMenu } from './AlertRuleActionsMenu';

jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(),
  createAssistantContextItem: jest.fn((type: string, data: object) => ({ type, ...data })),
}));
jest.mocked(useAssistant).mockReturnValue({
  isLoading: false,
  isAvailable: false,
  openAssistant: jest.fn(),
} as unknown as ReturnType<typeof useAssistant>);

const ALERT_RULES_URL = rulesUrl('alert');

/** Stands in for a Folders-mode row to observe folder counts. */
function FolderCountProbe() {
  const count = useFolderAlertRuleCount('folder-uid-1');
  return <div>{`Folder holds ${count.status === 'loaded' ? count.count : 'unknown'} rules`}</div>;
}

function mockFolderCounts() {
  const state = { requests: 0, count: 3 };
  server.use(
    http.get(FOLDER_COUNTS_URL, () => {
      state.requests += 1;
      return HttpResponse.json({
        counts: [{ resource: 'alertrules', group: 'rules.alerting.grafana.app', count: state.count }],
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
}: { annotations?: Record<string, string>; labels?: Record<string, string> } = {}): AlertRule {
  return buildRuleWith({ annotations, labels });
}

setBackendSrv(backendSrv);
setupMswServer();

async function openMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /more/i }));
  return user;
}

function renderLoaded(rule = buildRule(), options?: Parameters<typeof render>[1]) {
  return render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule }} />, options);
}

function renderWithFolderCountProbe() {
  return render(
    <>
      <FolderCountProbe />
      <AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />
    </>
  );
}

describe('AlertRuleActionsMenu', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate]);
    mockFolderApi(server).folder('folder-uid-1', mockFolder({ uid: 'folder-uid-1' }));
    server.use(http.patch(`${ALERT_RULES_URL}/rule-uid-1`, () => HttpResponse.json(buildRule())));
  });

  it('Pause patches only spec.paused to true', async () => {
    const requests = captureRequests((request) => request.method === 'PATCH' && request.url.includes(ALERT_RULES_URL));

    renderLoaded();
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /pause/i }));

    const [request] = await requests;
    expect(request.method).toBe('PATCH');
    expect(await request.clone().json()).toEqual({ spec: { paused: true } });
  });

  it('a successful Pause refetches the folder counts', async () => {
    const counts = mockFolderCounts();

    renderWithFolderCountProbe();
    expect(await screen.findByText('Folder holds 3 rules')).toBeInTheDocument();
    counts.count = 4;

    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /pause/i }));

    expect(await screen.findByText('Folder holds 4 rules')).toBeInTheDocument();
    expect(counts.requests).toBe(2);
  });

  it('Delete confirms the rule title, and a failure keeps the data as it was', async () => {
    server.use(
      http.delete(`${ALERT_RULES_URL}/rule-uid-1`, () => HttpResponse.json({ message: 'boom' }, { status: 500 }))
    );
    const counts = mockFolderCounts();

    renderWithFolderCountProbe();
    await screen.findByText('Folder holds 3 rules');
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));

    expect(await screen.findByText('Delete "High CPU usage"?')).toBeInTheDocument();
    expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/unable to delete rule/i)).toBeInTheDocument();
    expect(counts.requests).toBe(1);
  });

  it('explains the sequence restriction instead of the raw API message', async () => {
    server.use(
      http.delete(`${ALERT_RULES_URL}/rule-uid-1`, () =>
        HttpResponse.json(
          { message: 'cannot delete rule "rule-uid-1" because it belongs to rule sequence "seq-1"' },
          { status: 409 }
        )
      )
    );

    renderLoaded();
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/must be removed from it before it can be deleted/i)).toBeInTheDocument();
    expect(screen.queryByText(/because it belongs to rule sequence/i)).not.toBeInTheDocument();
  });

  it('a successful Delete refetches the folder counts', async () => {
    server.use(http.delete(`${ALERT_RULES_URL}/rule-uid-1`, () => HttpResponse.json({})));
    const counts = mockFolderCounts();

    renderWithFolderCountProbe();
    await screen.findByText('Folder holds 3 rules');
    counts.count = 2;
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Folder holds 2 rules')).toBeInTheDocument();
  });

  it('copies the share URL of the rule and confirms', async () => {
    const writeText = jest.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    renderLoaded();
    const user = await openMenu();

    await user.click(screen.getByRole('menuitem', { name: /copy link/i }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/alerting\/grafana\/rule-uid-1\/view$/))
    );
  });

  describe('unavailable actions show their reason', () => {
    const MUTATING_ACTIONS = ['Pause', 'Delete'];
    // reason is in the accessible name, not only a tooltip.
    async function expectDisabledWithReason(user: Awaited<ReturnType<typeof openMenu>>, name: string, reason: string) {
      const item = screen.getByRole('menuitem', { name: `${name}: ${reason}` });
      expect(isDisabled(item)).toBe(true);
      await user.hover(item);
      expect(await screen.findByText(reason)).toBeInTheDocument();
      await user.unhover(item);
    }

    function isDisabled(element: HTMLElement) {
      return element.getAttribute('aria-disabled') === 'true' || element.hasAttribute('disabled');
    }

    it('shows every action disabled as checking while the full rule is loading, without any rule request', async () => {
      const requests = captureRequests((request) => request.url.includes(ALERT_RULES_URL));

      render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loading' }} />);
      const user = await openMenu();

      for (const name of [...MUTATING_ACTIONS, 'Duplicate', 'Silence notifications']) {
        await expectDisabledWithReason(user, name, 'Checking permissions...');
      }
      expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeEnabled();
      expect((await requests).length).toBe(0);
    });

    it('opens from the keyboard and arrow navigation skips the disabled actions', async () => {
      const user = userEvent.setup();
      render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loading' }} />);

      screen.getByRole('button', { name: 'More' }).focus();
      await user.keyboard('{Enter}');
      await user.keyboard('{ArrowDown}');

      expect(screen.getByRole('menuitem', { name: 'Copy link' })).toHaveFocus();
    });

    it.each([
      {
        name: 'the full rule failed to load',
        state: FAILED_RULE,
        duplicateShown: false,
      },
      {
        name: 'the rule is provisioned',
        state: loadedRule(buildRule({ annotations: PROVISIONED_ANNOTATIONS })),
        duplicateShown: true,
      },
    ])('leaves Pause and Delete out of the menu when $name', async ({ state, duplicateShown }) => {
      render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={state} />);
      await openMenu();

      expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
      for (const name of [...MUTATING_ACTIONS, 'Resume']) {
        expect(screen.queryByRole('menuitem', { name: new RegExp(`^${name}`) })).not.toBeInTheDocument();
      }
      expect(screen.queryByRole('menuitem', { name: /^Duplicate/ }) !== null).toBe(duplicateShown);
    });
  });
  it('Duplicate is a plain link to the editor copy route with no returnTo', async () => {
    renderLoaded();
    await openMenu();

    const href = screen.getByRole('menuitem', { name: 'Duplicate' }).getAttribute('href');
    expect(href).toBe('/alerting/new?copyFrom=rule-uid-1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('Duplicate of a provisioned or managed rule confirms first', () => {
    const MANAGED_ANNOTATIONS = { ...WRITABLE_ANNOTATIONS, 'grafana.app/managedBy': 'terraform' };

    const LIST_ENTRY = { historyOptions: { initialEntries: ['/alerting/rules/alert'] } };

    it.each([
      ['provisioned', PROVISIONED_ANNOTATIONS],
      ['managed', MANAGED_ANNOTATIONS],
    ])('asks before copying a %s rule and navigates to the copy route on Copy', async (_kind, annotations) => {
      renderLoaded(buildRule({ annotations }), LIST_ENTRY);
      const user = await openMenu();
      const item = screen.getByRole('menuitem', { name: 'Duplicate' });
      expect(item).not.toHaveAttribute('href');
      await user.click(item);

      const dialog = await screen.findByRole('dialog', { name: 'Copy provisioned alert rule' });
      expect(dialog).toHaveTextContent('The new rule will not be marked as a provisioned rule.');
      expect(dialog).toHaveTextContent(
        'You will need to set a new evaluation group for the copied rule because the original one has been provisioned and cannot be used for rules created in the UI.'
      );
      expect(locationService.getLocation().pathname).toBe('/alerting/rules/alert');

      await user.click(within(dialog).getByRole('button', { name: 'Copy' }));

      expect(locationService.getLocation().pathname).toBe('/alerting/new');
      expect(locationService.getLocation().search).toBe('?copyFrom=rule-uid-1');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('stays on the list when the confirmation is cancelled', async () => {
      renderLoaded(buildRule({ annotations: PROVISIONED_ANNOTATIONS }), LIST_ENTRY);
      const user = await openMenu();
      await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
      const dialog = await screen.findByRole('dialog', { name: 'Copy provisioned alert rule' });

      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(locationService.getLocation().pathname).toBe('/alerting/rules/alert');
    });
  });

  describe('Silence availability gate', () => {
    it('shows Silence when Grafana AM is supported and the user has org-wide alert.instances:create, and opens the drawer for this rule', async () => {
      grantUserPermissions([AccessControlAction.AlertingRuleCreate, AccessControlAction.AlertingInstanceCreate]);
      // The drawer loads the rule itself, by the UID this menu passes.
      server.use(http.get(`${ALERT_RULES_URL}/rule-uid-1`, () => HttpResponse.json(buildRule())));

      renderLoaded();
      const user = await openMenu();
      const silenceItem = await screen.findByRole('menuitem', { name: /silence notifications/i });
      await waitFor(() => expect(silenceItem).toBeEnabled());
      await user.click(silenceItem);

      expect(await screen.findByText('Silence alert rule')).toBeInTheDocument();
      expect(document.getElementById('alert-rule-name')).toHaveValue('High CPU usage');
    });

    it('shows Silence when the user has only folder-scoped alert.silences:create (no org permission)', async () => {
      mockFolderApi(server).folder(
        'folder-uid-1',
        mockFolder({ uid: 'folder-uid-1', accessControl: { [AccessControlAction.AlertingSilenceCreate]: true } })
      );

      renderLoaded();
      await openMenu();

      await waitFor(() => expect(screen.getByRole('menuitem', { name: /silence notifications/i })).toBeEnabled());
    });

    it('leaves Silence out once resolved as denied when the user has neither org-wide nor folder-scoped silence permission', async () => {
      renderLoaded();
      await openMenu();

      await waitFor(() => expect(screen.queryByRole('menuitem', { name: /^Silence/ })).not.toBeInTheDocument());
      expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
    });

    it('leaves Silence out when Grafana sends only to external Alertmanagers, even with org permission', async () => {
      grantUserPermissions([AccessControlAction.AlertingRuleCreate, AccessControlAction.AlertingInstanceCreate]);
      server.use(
        http.get('/api/v1/ngalert', () =>
          HttpResponse.json({ alertmanagersChoice: AlertmanagerChoice.External, numExternalAlertmanagers: 1 })
        )
      );

      renderLoaded();
      await openMenu();

      await waitFor(() => expect(screen.queryByRole('menuitem', { name: /^Silence/ })).not.toBeInTheDocument());
      expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
    });

    it.each([
      { pending: 'folder', url: '/api/folders/folder-uid-1', body: () => mockFolder({ uid: 'folder-uid-1' }) },
      {
        pending: 'Alertmanager configuration',
        url: '/api/v1/ngalert',
        body: () => ({ alertmanagersChoice: AlertmanagerChoice.Internal, numExternalAlertmanagers: 0 }),
      },
    ])('keeps Silence disabled as checking until the $pending has loaded', async ({ url, body }) => {
      grantUserPermissions([AccessControlAction.AlertingRuleCreate, AccessControlAction.AlertingInstanceCreate]);
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      server.use(
        http.get(url, async () => {
          await gate;
          return HttpResponse.json(body());
        })
      );

      renderLoaded();
      const user = await openMenu();
      const silence = screen.getByRole('menuitem', { name: 'Silence notifications: Checking permissions...' });

      expect(silence).toBeDisabled();
      await user.hover(silence);
      expect(await screen.findByText('Checking permissions...')).toBeInTheDocument();

      release();
      await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Silence notifications' })).toBeEnabled());
    });
  });

  describe('Manage enrichments availability gate', () => {
    const previousOrgRole = contextSrv.user.orgRole;

    beforeEach(() => {
      addEnrichmentDrawerExtension(({ ruleUid }) => (
        <div data-testid="enrichment-drawer-stub">enrichment for {ruleUid}</div>
      ));
    });

    afterEach(() => {
      contextSrv.user.orgRole = previousOrgRole;
    });

    describe('with both toggles on', () => {
      testWithFeatureToggles({ enable: ['alertEnrichment', 'alertingEnrichmentPerRule'] });

      it('shows Manage enrichments to an org Admin and opens the extension for this rule', async () => {
        contextSrv.user.orgRole = OrgRole.Admin;

        renderLoaded();
        const user = await openMenu();
        await user.click(await screen.findByRole('menuitem', { name: /manage enrichments/i }));

        expect(await screen.findByTestId('enrichment-drawer-stub')).toHaveTextContent('enrichment for rule-uid-1');
      });

      it('shows Manage enrichments to a non-admin with alert.enrichments:read', async () => {
        contextSrv.user.orgRole = OrgRole.Editor;
        grantUserPermissions([AccessControlAction.AlertingRuleCreate, AccessControlAction.AlertingEnrichmentsRead]);

        renderLoaded();
        await openMenu();

        expect(await screen.findByRole('menuitem', { name: /manage enrichments/i })).toBeInTheDocument();
      });

      it('hides Manage enrichments without the admin role or alert.enrichments:read', async () => {
        contextSrv.user.orgRole = OrgRole.Editor;

        renderLoaded();
        await openMenu();

        expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: /manage enrichments/i })).not.toBeInTheDocument();
      });
    });

    describe.each([
      { off: 'alertEnrichment', on: 'alertingEnrichmentPerRule' },
      { off: 'alertingEnrichmentPerRule', on: 'alertEnrichment' },
    ] as const)('with $off off and $on on', ({ off, on }) => {
      testWithFeatureToggles({ enable: [on], disable: [off] });

      it('hides Manage enrichments from an org Admin', async () => {
        contextSrv.user.orgRole = OrgRole.Admin;

        renderLoaded();
        await openMenu();

        expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: /manage enrichments/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Analyze availability gate', () => {
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

    it.each([
      { name: 'the Assistant is unavailable', available: false, state: loadedRule(buildRule()), shown: false },
      {
        name: 'the full rule is not loaded, even with the Assistant available',
        available: true,
        state: LOADING_RULE,
        shown: false,
      },
      {
        name: 'the Assistant is available and the rule is loaded',
        available: true,
        state: loadedRule(buildRule()),
        shown: true,
      },
    ])('Analyze shown=$shown when $name', async ({ available, state, shown }) => {
      mockAssistant(available);
      render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={state} />);
      await openMenu();

      expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Analyze rule' }) !== null).toBe(shown);
    });

    it('opens the Assistant for the loaded rule', async () => {
      const openAssistant = mockAssistant(true);
      renderLoaded();
      const user = await openMenu();

      await user.click(screen.getByRole('menuitem', { name: 'Analyze rule' }));

      expect(openAssistant).toHaveBeenCalledTimes(1);
      const [{ prompt, origin }] = openAssistant.mock.calls[0];
      expect(origin).toBe('alerting/analyze-rule-menu-item');
      expect(prompt).toContain('"High CPU usage (uid: rule-uid-1)"');
    });
  });
});
