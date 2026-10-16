import { HttpResponse, http } from 'msw';
import { render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { getAPIBaseURL } from '@grafana/api-clients';
import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useAssistant } from '@grafana/assistant';
import { OrgRole } from '@grafana/data';
import { config, locationService, setBackendSrv } from '@grafana/runtime';
import server from '@grafana/test-utils/server';
import { appEvents } from 'app/core/app_events';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { addEnrichmentDrawerExtension } from 'app/features/alerting/unified/components/rule-list/extensions/EnrichmentDrawerExtension';
import { mockFolderApi, setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions, mockFolder } from 'app/features/alerting/unified/mocks';
import { captureRequests } from 'app/features/alerting/unified/mocks/server/events';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { useFolderAlertRuleCount } from '../folder-browsing/folderLookups';

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

const ALERT_RULES_URL = `${getAPIBaseURL('rules.alerting.grafana.app', 'v0alpha1')}/alertrules`;
const FOLDER_COUNTS_URL = `${getAPIBaseURL('folder.grafana.app', 'v1beta1')}/folders/:name/counts`;

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
  return {
    apiVersion: 'v0alpha1',
    kind: 'AlertRule',
    metadata: { name: 'rule-uid-1', annotations },
    spec: {
      title: 'High CPU usage',
      labels,
      execErrState: 'Alerting',
      noDataState: 'NoData',
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

  it('ALERT-7: Pause patches only spec.paused to true', async () => {
    const requests = captureRequests((request) => request.method === 'PATCH' && request.url.includes(ALERT_RULES_URL));

    renderLoaded();
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /pause/i }));

    const [request] = await requests;
    expect(request.method).toBe('PATCH');
    expect(await request.clone().json()).toEqual({ spec: { paused: true } });
  });

  it('STATE-3: a successful Pause refetches the folder counts', async () => {
    const counts = mockFolderCounts();

    renderWithFolderCountProbe();
    expect(await screen.findByText('Folder holds 3 rules')).toBeInTheDocument();
    counts.count = 4;

    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /pause/i }));

    expect(await screen.findByText('Folder holds 4 rules')).toBeInTheDocument();
    expect(counts.requests).toBe(2);
  });

  it('ALERT-8: Delete confirms the rule title, and a failure keeps the data as it was', async () => {
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

  it('ALERT-8: explains the sequence restriction instead of the raw API message', async () => {
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

  it('ALERT-8: a successful Delete refetches the folder counts', async () => {
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

  it('reports Copy link failure when the clipboard write rejects', async () => {
    jest.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    const emitSpy = jest.spyOn(appEvents, 'emit');

    renderLoaded();
    const user = await openMenu();
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
      expect(emitSpy).not.toHaveBeenCalledWith('alert-success', expect.anything());
    } finally {
      if (clipboard) {
        Object.defineProperty(navigator, 'clipboard', clipboard);
      }
    }
  });

  it('confirms Copy link when the clipboard write succeeds', async () => {
    const emitSpy = jest.spyOn(appEvents, 'emit');

    renderLoaded();
    const user = await openMenu();
    jest.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.click(screen.getByRole('menuitem', { name: /copy link/i }));

    await waitFor(() => expect(emitSpy).toHaveBeenCalledWith('alert-success', ['URL copied to clipboard']));
  });

  describe('unavailable actions show their reason', () => {
    const MUTATING_ACTIONS = ['Pause', 'Delete'];

    // ACC-7: reason is in the accessible name, not only a tooltip.
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

    it('ACT-1: shows every action disabled as checking while the full rule is loading, without any rule request', async () => {
      const requests = captureRequests((request) => request.url.includes(ALERT_RULES_URL));

      render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loading' }} />);
      const user = await openMenu();

      for (const name of [...MUTATING_ACTIONS, 'Duplicate', 'Silence notifications']) {
        await expectDisabledWithReason(user, name, 'Checking permissions...');
      }
      expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeEnabled();
      expect((await requests).length).toBe(0);
    });

    it('ACC-7: opens from the keyboard and arrow navigation skips the disabled actions', async () => {
      const user = userEvent.setup();
      render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loading' }} />);

      screen.getByRole('button', { name: 'More' }).focus();
      await user.keyboard('{Enter}');
      await user.keyboard('{ArrowDown}');

      expect(screen.getByRole('menuitem', { name: 'Copy link' })).toHaveFocus();
    });

    it.each([
      {
        id: 'ACT-2',
        name: 'the full rule failed to load',
        state: { status: 'error' } as const,
        duplicateShown: false,
      },
      {
        id: 'ACT-2',
        name: 'the capability annotations are missing on a loaded rule',
        state: { status: 'loaded', rule: buildRule({ annotations: {} }) } as const,
        duplicateShown: true,
      },
      {
        id: 'ACT-3',
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
        duplicateShown: true,
      },
      {
        id: 'ACT-4',
        name: 'the rule is provisioned',
        state: { status: 'loaded', rule: buildRule({ annotations: PROVISIONED_ANNOTATIONS }) } as const,
        duplicateShown: true,
      },
      {
        id: 'ACT-5',
        name: 'the origin label starts with plugin/',
        state: { status: 'loaded', rule: buildRule({ labels: { __grafana_origin: 'plugin/my-app' } }) } as const,
        duplicateShown: false,
      },
      {
        id: 'ACT-7',
        name: 'the rule is managed by Terraform',
        state: {
          status: 'loaded',
          rule: buildRule({ annotations: { ...PROVISIONED_ANNOTATIONS, 'grafana.app/managedBy': 'terraform' } }),
        } as const,
        duplicateShown: true,
      },
    ])('$id: leaves Pause and Delete out of the menu when $name', async ({ state, duplicateShown }) => {
      render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={state} />);
      await openMenu();

      expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
      for (const name of [...MUTATING_ACTIONS, 'Resume']) {
        expect(screen.queryByRole('menuitem', { name: new RegExp(`^${name}`) })).not.toBeInTheDocument();
      }
      expect(screen.queryByRole('menuitem', { name: /^Duplicate/ }) !== null).toBe(duplicateShown);
    });

    it('ACT-3: shows only the always-available items to a Viewer-like user without capabilities', async () => {
      grantUserPermissions([]);
      renderLoaded(buildRule({ annotations: {} }));
      await openMenu();

      await waitFor(() => expect(screen.queryByRole('menuitem', { name: /^Silence/ })).not.toBeInTheDocument());
      for (const name of [/^Pause/, /^Delete/, /^Duplicate/, /^Silence/]) {
        expect(screen.queryByRole('menuitem', { name })).not.toBeInTheDocument();
      }
      const copyLink = screen.getByRole('menuitem', { name: 'Copy link' });
      expect(copyLink).toBeEnabled();
      // Without the Assistant, Analyze is absent too, so no divider is left above Copy link.
      expect(copyLink.previousElementSibling).toBeNull();
    });

    it.each([
      {
        id: 'ACT-5',
        name: 'the origin label is not plugin/',
        rule: buildRule({ labels: { __grafana_origin: 'my-script' } }),
        names: [...MUTATING_ACTIONS, 'Duplicate'],
      },
      {
        id: 'ACT-7',
        name: 'the manager is the Grafana UI',
        rule: buildRule({ annotations: { ...WRITABLE_ANNOTATIONS, 'grafana.app/managedBy': 'grafana' } }),
        names: MUTATING_ACTIONS,
      },
    ])('$id: applies no restriction when $name', async ({ rule, names }) => {
      renderLoaded(rule);
      await openMenu();

      for (const name of names) {
        expect(isDisabled(screen.getByRole('menuitem', { name }))).toBe(false);
      }
    });
  });

  it('ALERT-6: Duplicate is a plain link to the editor copy route with no returnTo', async () => {
    renderLoaded();
    await openMenu();

    const href = screen.getByRole('menuitem', { name: 'Duplicate' }).getAttribute('href');
    expect(href).toBe('/alerting/new?copyFrom=rule-uid-1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('ALERT-6: Duplicate of a provisioned or managed rule confirms first', () => {
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

  it('never issues a rule search request', async () => {
    const requests = captureRequests(
      (request) => request.url.includes('searchRules') || request.url.includes('/search')
    );

    renderLoaded();
    await openMenu();

    expect((await requests).length).toBe(0);
  });

  describe('ALERT-9: Silence availability gate', () => {
    it('shows Silence when Grafana AM is supported and the user has org-wide alert.instances:create, and opens the drawer for this rule', async () => {
      grantUserPermissions([AccessControlAction.AlertingRuleCreate, AccessControlAction.AlertingInstanceCreate]);

      renderLoaded();
      const user = await openMenu();
      const silenceItem = await screen.findByRole('menuitem', { name: /silence notifications/i });
      await waitFor(() => expect(silenceItem).toBeEnabled());
      await user.click(silenceItem);

      // Drawer is populated from this menu's rule, proving it received the right UID.
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

    it('ACT-3: leaves Silence out once resolved as denied when the user has neither org-wide nor folder-scoped silence permission', async () => {
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
    ])('ACT-6: keeps Silence disabled as checking until the $pending has loaded', async ({ url, body }) => {
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

  describe('ACT-9: Manage enrichments availability gate', () => {
    const previousOrgRole = contextSrv.user.orgRole;

    beforeEach(() => {
      addEnrichmentDrawerExtension(({ ruleUid }) => (
        <div data-testid="enrichment-drawer-stub">enrichment for {ruleUid}</div>
      ));
    });

    afterEach(() => {
      contextSrv.user.orgRole = previousOrgRole;
      config.featureToggles.alertEnrichment = false;
      config.featureToggles.alertingEnrichmentPerRule = false;
    });

    it('shows Manage enrichments when both toggles are on and the user is an org Admin, and opens the extension for this rule', async () => {
      config.featureToggles.alertEnrichment = true;
      config.featureToggles.alertingEnrichmentPerRule = true;
      contextSrv.user.orgRole = OrgRole.Admin;

      renderLoaded();
      const user = await openMenu();
      const enrichmentItem = await screen.findByRole('menuitem', { name: /manage enrichments/i });
      await user.click(enrichmentItem);

      expect(await screen.findByTestId('enrichment-drawer-stub')).toHaveTextContent('enrichment for rule-uid-1');
    });

    it.each([
      {
        title: 'shows Manage enrichments when both toggles are on and the user has alert.enrichments:read (non-admin)',
        alertEnrichment: true,
        alertingEnrichmentPerRule: true,
        orgRole: OrgRole.Editor,
        grantEnrichmentsRead: true,
        shown: true,
      },
      {
        title: 'hides Manage enrichments when alertEnrichment is off, even with the per-rule toggle on and admin',
        alertEnrichment: false,
        alertingEnrichmentPerRule: true,
        orgRole: OrgRole.Admin,
        grantEnrichmentsRead: false,
        shown: false,
      },
      {
        title: 'hides Manage enrichments when alertingEnrichmentPerRule is off, even with alertEnrichment on and admin',
        alertEnrichment: true,
        alertingEnrichmentPerRule: false,
        orgRole: OrgRole.Admin,
        grantEnrichmentsRead: false,
        shown: false,
      },
      {
        title: 'hides Manage enrichments without admin role or alert.enrichments:read, even with both toggles on',
        alertEnrichment: true,
        alertingEnrichmentPerRule: true,
        orgRole: OrgRole.Editor,
        grantEnrichmentsRead: false,
        shown: false,
      },
    ])('$title', async ({ alertEnrichment, alertingEnrichmentPerRule, orgRole, grantEnrichmentsRead, shown }) => {
      config.featureToggles.alertEnrichment = alertEnrichment;
      config.featureToggles.alertingEnrichmentPerRule = alertingEnrichmentPerRule;
      contextSrv.user.orgRole = orgRole;
      if (grantEnrichmentsRead) {
        grantUserPermissions([AccessControlAction.AlertingRuleCreate, AccessControlAction.AlertingEnrichmentsRead]);
      }

      renderLoaded();
      await openMenu();

      const enrichmentItem = screen.queryByRole('menuitem', { name: /manage enrichments/i });
      if (shown) {
        expect(enrichmentItem).toBeInTheDocument();
      } else {
        expect(enrichmentItem).not.toBeInTheDocument();
      }
    });
  });

  describe('ALERT-9: Analyze availability gate and payload from the loaded full Alert rule, never defaulting state to firing', () => {
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
      render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loading' }} />);
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

    it('opens the Assistant with the loaded rule and omits state from the prompt when status.state is missing', async () => {
      const openAssistant = mockAssistant(true);
      const rule = buildRule({ labels: { team: 'infra' } });
      rule.spec.annotations = { summary: 'CPU is high' };
      rule.spec.expressions = { A: { model: { expr: 'avg(cpu)' } } as AlertRule['spec']['expressions'][string] };
      renderLoaded(rule);
      const user = await openMenu();

      await user.click(screen.getByRole('menuitem', { name: 'Analyze rule' }));

      expect(openAssistant).toHaveBeenCalledTimes(1);
      const [{ prompt, context, origin, autoSend }] = openAssistant.mock.calls[0];
      expect(origin).toBe('alerting/analyze-rule-menu-item');
      expect(autoSend).toBe(true);
      expect(prompt).toContain('Analyze the alert rule "High CPU usage (uid: rule-uid-1)".');
      expect(prompt).toContain('CPU is high Labels: team="infra".');
      expect(prompt).not.toMatch(/firing|currently/i);
      expect(context).toEqual([
        {
          type: 'structured',
          title: 'Alert: High CPU usage',
          data: {
            rule: {
              name: 'rule-uid-1',
              title: 'High CPU usage',
              labels: { team: 'infra' },
              expressions: { A: { model: { expr: 'avg(cpu)' } } },
              annotations: { summary: 'CPU is high' },
            },
          },
        },
      ]);
    });

    it('reports the state the API returned instead of a default', async () => {
      const openAssistant = mockAssistant(true);
      const rule = buildRule();
      rule.status = { state: 'Healthy' };
      renderLoaded(rule);
      const user = await openMenu();

      await user.click(screen.getByRole('menuitem', { name: 'Analyze rule' }));

      const [{ prompt }] = openAssistant.mock.calls[0];
      expect(prompt).toContain('Analyze the alert rule "High CPU usage (uid: rule-uid-1)" (currently Healthy).');
      expect(prompt).not.toMatch(/firing/i);
    });
  });
});
