import { HttpResponse, http } from 'msw';
import { render, screen, userEvent, waitFor } from 'test/test-utils';

import { getAPIBaseURL } from '@grafana/api-clients';
import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useAssistant } from '@grafana/assistant';
import { OrgRole } from '@grafana/data';
import { config, setBackendSrv } from '@grafana/runtime';
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

/** Stands in for a Folders-mode row, so a mutation's effect on folder counts is observable. */
function FolderCountProbe() {
  const count = useFolderAlertRuleCount('folder-uid-1');
  return <div>{`Folder holds ${count ?? 'unknown'} rules`}</div>;
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

describe('AlertRuleActionsMenu', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate]);
    mockFolderApi(server).folder('folder-uid-1', mockFolder({ uid: 'folder-uid-1' }));
    server.use(http.patch(`${ALERT_RULES_URL}/rule-uid-1`, () => HttpResponse.json(buildRule())));
  });

  it('ALERT-7: Pause patches only spec.paused to true', async () => {
    const requests = captureRequests((request) => request.method === 'PATCH' && request.url.includes(ALERT_RULES_URL));

    render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />);
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /pause/i }));

    const [request] = await requests;
    expect(request.method).toBe('PATCH');
    expect(await request.clone().json()).toEqual({ spec: { paused: true } });
  });

  it('STATE-3: a successful Pause refetches the folder counts', async () => {
    const counts = mockFolderCounts();

    render(
      <>
        <FolderCountProbe />
        <AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />
      </>
    );
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

    render(
      <>
        <FolderCountProbe />
        <AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />
      </>
    );
    await screen.findByText('Folder holds 3 rules');
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));

    expect(await screen.findByText(/High CPU usage/)).toBeInTheDocument();
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

    render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />);
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/must be removed from it before it can be deleted/i)).toBeInTheDocument();
    expect(screen.queryByText(/because it belongs to rule sequence/i)).not.toBeInTheDocument();
  });

  it('ALERT-8: a successful Delete refetches the folder counts', async () => {
    server.use(http.delete(`${ALERT_RULES_URL}/rule-uid-1`, () => HttpResponse.json({})));
    const counts = mockFolderCounts();

    render(
      <>
        <FolderCountProbe />
        <AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />
      </>
    );
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

    render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />);
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /copy link/i }));

    await waitFor(() => expect(emitSpy).toHaveBeenCalledWith('alert-error', ['Could not copy URL to clipboard']));
  });

  describe('unavailable actions show their reason', () => {
    const MUTATING_ACTIONS = ['Pause', 'Delete'];

    // ACC-7: the reason is part of the disabled item's accessible name, not only a hover tooltip.
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

    it('ACT-2: shows every action disabled as unknown when the full rule failed to load', async () => {
      render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'error' }} />);
      const user = await openMenu();

      for (const name of [...MUTATING_ACTIONS, 'Duplicate']) {
        await expectDisabledWithReason(user, name, 'Permission unknown');
      }
    });

    it('ACT-2: treats a missing capability annotation as unknown, not as permission', async () => {
      render(
        <AlertRuleActionsMenu
          ruleUid="rule-uid-1"
          resourceState={{ status: 'loaded', rule: buildRule({ annotations: {} }) }}
        />
      );
      const user = await openMenu();

      for (const name of MUTATING_ACTIONS) {
        await expectDisabledWithReason(user, name, 'Permission unknown');
      }
    });

    it('ACT-3: disables Pause and Delete as denied when the capabilities are false, and Duplicate without create permission', async () => {
      grantUserPermissions([]);
      render(
        <AlertRuleActionsMenu
          ruleUid="rule-uid-1"
          resourceState={{
            status: 'loaded',
            rule: buildRule({
              annotations: {
                ...WRITABLE_ANNOTATIONS,
                'grafana.com/access/canWrite': 'false',
                'grafana.com/access/canDelete': 'false',
              },
            }),
          }}
        />
      );
      const user = await openMenu();

      for (const name of [...MUTATING_ACTIONS, 'Duplicate']) {
        await expectDisabledWithReason(user, name, 'You do not have permission to do this');
      }
    });

    it('ACT-4: disables Pause and Delete for a provisioned rule and keeps Duplicate enabled', async () => {
      render(
        <AlertRuleActionsMenu
          ruleUid="rule-uid-1"
          resourceState={{ status: 'loaded', rule: buildRule({ annotations: PROVISIONED_ANNOTATIONS }) }}
        />
      );
      const user = await openMenu();

      for (const name of MUTATING_ACTIONS) {
        await expectDisabledWithReason(user, name, 'Provisioned');
      }
      expect(isDisabled(screen.getByRole('menuitem', { name: 'Duplicate' }))).toBe(false);
    });

    it('ACT-5: disables Pause, Delete and Duplicate for a rule whose origin label starts with plugin/', async () => {
      render(
        <AlertRuleActionsMenu
          ruleUid="rule-uid-1"
          resourceState={{ status: 'loaded', rule: buildRule({ labels: { __grafana_origin: 'plugin/my-app' } }) }}
        />
      );
      const user = await openMenu();

      for (const name of [...MUTATING_ACTIONS, 'Duplicate']) {
        await expectDisabledWithReason(
          user,
          name,
          'This rule is managed by a plugin and cannot be edited through the UI'
        );
      }
    });

    it('ACT-5: applies no plugin restriction to any other __grafana_origin value', async () => {
      render(
        <AlertRuleActionsMenu
          ruleUid="rule-uid-1"
          resourceState={{ status: 'loaded', rule: buildRule({ labels: { __grafana_origin: 'my-script' } }) }}
        />
      );
      await openMenu();

      for (const name of [...MUTATING_ACTIONS, 'Duplicate']) {
        expect(isDisabled(screen.getByRole('menuitem', { name }))).toBe(false);
      }
    });

    it('ACT-7: names the manager in the reason for a managed rule and keeps Duplicate enabled', async () => {
      render(
        <AlertRuleActionsMenu
          ruleUid="rule-uid-1"
          resourceState={{
            status: 'loaded',
            rule: buildRule({ annotations: { ...PROVISIONED_ANNOTATIONS, 'grafana.app/managedBy': 'terraform' } }),
          }}
        />
      );
      const user = await openMenu();

      for (const name of MUTATING_ACTIONS) {
        await expectDisabledWithReason(user, name, 'Managed by Terraform');
      }
      expect(isDisabled(screen.getByRole('menuitem', { name: 'Duplicate' }))).toBe(false);
    });

    it('ACT-7: treats the Grafana UI as no manager', async () => {
      render(
        <AlertRuleActionsMenu
          ruleUid="rule-uid-1"
          resourceState={{
            status: 'loaded',
            rule: buildRule({
              annotations: { ...WRITABLE_ANNOTATIONS, 'grafana.app/managedBy': 'grafana' },
            }),
          }}
        />
      );
      await openMenu();

      for (const name of MUTATING_ACTIONS) {
        expect(isDisabled(screen.getByRole('menuitem', { name }))).toBe(false);
      }
    });
  });

  it('ALERT-6: Duplicate is a plain link to the editor copy route with no returnTo', async () => {
    render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />);
    await openMenu();

    const href = screen.getByRole('menuitem', { name: 'Duplicate' }).getAttribute('href');
    expect(href).toBe('/alerting/new?copyFrom=rule-uid-1');
  });

  it('never issues a rule search request', async () => {
    const requests = captureRequests(
      (request) => request.url.includes('searchRules') || request.url.includes('/search')
    );

    render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />);
    await openMenu();

    expect((await requests).length).toBe(0);
  });

  describe('ALERT-9: Silence availability gate', () => {
    it('shows Silence when Grafana AM is supported and the user has org-wide alert.instances:create, and opens the drawer for this rule', async () => {
      grantUserPermissions([AccessControlAction.AlertingRuleCreate, AccessControlAction.AlertingInstanceCreate]);

      render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />);
      const user = await openMenu();
      const silenceItem = await screen.findByRole('menuitem', { name: /silence notifications/i });
      await waitFor(() => expect(silenceItem).toBeEnabled());
      await user.click(silenceItem);

      // The drawer that opened is the Silence drawer, populated from the rule this exact
      // menu was given (title, not just some other rule) - proving it received the right UID.
      expect(await screen.findByText('Silence alert rule')).toBeInTheDocument();
      expect(document.getElementById('alert-rule-name')).toHaveValue('High CPU usage');
    });

    it('shows Silence when the user has only folder-scoped alert.silences:create (no org permission)', async () => {
      mockFolderApi(server).folder(
        'folder-uid-1',
        mockFolder({ uid: 'folder-uid-1', accessControl: { [AccessControlAction.AlertingSilenceCreate]: true } })
      );

      render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />);
      await openMenu();

      await waitFor(() => expect(screen.getByRole('menuitem', { name: /silence notifications/i })).toBeEnabled());
    });

    it('ACT-3: disables Silence as denied when the user has neither org-wide nor folder-scoped silence permission', async () => {
      render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />);
      const user = await openMenu();

      const silence = await screen.findByRole('menuitem', {
        name: 'Silence notifications: You do not have permission to do this',
      });
      expect(silence).toBeDisabled();
      await user.hover(silence);
      expect(await screen.findByText('You do not have permission to do this')).toBeInTheDocument();
    });

    it('disables Silence with a reason when Grafana sends only to external Alertmanagers, even with org permission', async () => {
      grantUserPermissions([AccessControlAction.AlertingRuleCreate, AccessControlAction.AlertingInstanceCreate]);
      server.use(
        http.get('/api/v1/ngalert', () =>
          HttpResponse.json({ alertmanagersChoice: AlertmanagerChoice.External, numExternalAlertmanagers: 1 })
        )
      );

      render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />);
      const user = await openMenu();

      const silence = await screen.findByRole('menuitem', { name: /^Silence notifications: .*external Alertmanagers/ });
      expect(silence).toBeDisabled();
      await user.hover(silence);
      expect(await screen.findByText(/only to external Alertmanagers/)).toBeInTheDocument();
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

      render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />);
      const user = await openMenu();
      const silence = screen.getByRole('menuitem', { name: 'Silence notifications: Checking permissions...' });

      expect(silence).toBeDisabled();
      await user.hover(silence);
      expect(await screen.findByText('Checking permissions...')).toBeInTheDocument();

      release();
      await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Silence notifications' })).toBeEnabled());
    });
  });

  describe('ALERT-9: Manage enrichments availability gate', () => {
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

      render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />);
      const user = await openMenu();
      const enrichmentItem = await screen.findByRole('menuitem', { name: /manage enrichments/i });
      await user.click(enrichmentItem);

      expect(await screen.findByTestId('enrichment-drawer-stub')).toHaveTextContent('enrichment for rule-uid-1');
    });

    it('shows Manage enrichments when both toggles are on and the user has alert.enrichments:read (non-admin)', async () => {
      config.featureToggles.alertEnrichment = true;
      config.featureToggles.alertingEnrichmentPerRule = true;
      contextSrv.user.orgRole = OrgRole.Editor;
      grantUserPermissions([AccessControlAction.AlertingRuleCreate, AccessControlAction.AlertingEnrichmentsRead]);

      render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />);
      await openMenu();

      expect(screen.getByRole('menuitem', { name: /manage enrichments/i })).toBeInTheDocument();
    });

    it('hides Manage enrichments when alertEnrichment is off, even with the per-rule toggle on and admin', async () => {
      config.featureToggles.alertEnrichment = false;
      config.featureToggles.alertingEnrichmentPerRule = true;
      contextSrv.user.orgRole = OrgRole.Admin;

      render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />);
      await openMenu();

      expect(screen.queryByRole('menuitem', { name: /manage enrichments/i })).not.toBeInTheDocument();
    });

    it('hides Manage enrichments when alertingEnrichmentPerRule is off, even with alertEnrichment on and admin', async () => {
      config.featureToggles.alertEnrichment = true;
      config.featureToggles.alertingEnrichmentPerRule = false;
      contextSrv.user.orgRole = OrgRole.Admin;

      render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />);
      await openMenu();

      expect(screen.queryByRole('menuitem', { name: /manage enrichments/i })).not.toBeInTheDocument();
    });

    it('hides Manage enrichments without admin role or alert.enrichments:read, even with both toggles on', async () => {
      config.featureToggles.alertEnrichment = true;
      config.featureToggles.alertingEnrichmentPerRule = true;
      contextSrv.user.orgRole = OrgRole.Editor;

      render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loaded', rule: buildRule() }} />);
      await openMenu();

      expect(screen.queryByRole('menuitem', { name: /manage enrichments/i })).not.toBeInTheDocument();
    });
  });
});
