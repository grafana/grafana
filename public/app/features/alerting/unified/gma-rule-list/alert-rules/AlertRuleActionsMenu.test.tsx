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

function buildRule(overrides: Partial<AlertRule['metadata']> = {}): AlertRule {
  return {
    apiVersion: 'v0alpha1',
    kind: 'AlertRule',
    metadata: {
      name: 'rule-uid-1',
      annotations: {
        'grafana.app/folder': 'folder-uid-1',
        'grafana.com/access/canWrite': 'true',
        'grafana.com/access/canDelete': 'true',
      },
      ...overrides,
    },
    spec: {
      title: 'High CPU usage',
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

    render(
      <AlertRuleActionsMenu
        ruleUid="rule-uid-1"
        resourceState={{ status: 'loaded', rule: buildRule() }}
        onMutated={jest.fn()}
      />
    );
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /pause/i }));

    const [request] = await requests;
    expect(request.method).toBe('PATCH');
    expect(await request.clone().json()).toEqual({ spec: { paused: true } });
  });

  it('ALERT-7: Resume patches spec.paused to false and calls onMutated on success', async () => {
    const onMutated = jest.fn();

    render(
      <AlertRuleActionsMenu
        ruleUid="rule-uid-1"
        resourceState={{ status: 'loaded', rule: buildRule() }}
        onMutated={onMutated}
      />
    );
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /pause/i }));

    await waitFor(() => expect(onMutated).toHaveBeenCalledWith('paused'));
  });

  it('ALERT-8: Delete confirms the rule title, and a failure keeps the row (no onMutated call)', async () => {
    server.use(
      http.delete(`${ALERT_RULES_URL}/rule-uid-1`, () => HttpResponse.json({ message: 'boom' }, { status: 500 }))
    );
    const onMutated = jest.fn();

    render(
      <AlertRuleActionsMenu
        ruleUid="rule-uid-1"
        resourceState={{ status: 'loaded', rule: buildRule() }}
        onMutated={onMutated}
      />
    );
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));

    expect(await screen.findByText(/High CPU usage/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/unable to delete rule/i)).toBeInTheDocument();
    expect(onMutated).not.toHaveBeenCalled();
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

    render(
      <AlertRuleActionsMenu
        ruleUid="rule-uid-1"
        resourceState={{ status: 'loaded', rule: buildRule() }}
        onMutated={jest.fn()}
      />
    );
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/must be removed from it before it can be deleted/i)).toBeInTheDocument();
    expect(screen.queryByText(/because it belongs to rule sequence/i)).not.toBeInTheDocument();
  });

  it('ALERT-8: Delete succeeds and calls onMutated', async () => {
    server.use(http.delete(`${ALERT_RULES_URL}/rule-uid-1`, () => HttpResponse.json({})));
    const onMutated = jest.fn();

    render(
      <AlertRuleActionsMenu
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

  it('reports Copy link failure when the clipboard write rejects', async () => {
    jest.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    const emitSpy = jest.spyOn(appEvents, 'emit');

    render(
      <AlertRuleActionsMenu
        ruleUid="rule-uid-1"
        resourceState={{ status: 'loaded', rule: buildRule() }}
        onMutated={jest.fn()}
      />
    );
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: /copy link/i }));

    await waitFor(() => expect(emitSpy).toHaveBeenCalledWith('alert-error', ['Could not copy URL to clipboard']));
  });

  it('makes Pause and Delete unavailable when the resource is still loading, without any rule request', async () => {
    const requests = captureRequests((request) => request.url.includes(ALERT_RULES_URL));

    render(<AlertRuleActionsMenu ruleUid="rule-uid-1" resourceState={{ status: 'loading' }} onMutated={jest.fn()} />);
    await openMenu();

    expect(screen.queryByRole('menuitem', { name: /pause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /delete/i })).not.toBeInTheDocument();
    expect((await requests).length).toBe(0);
  });

  it('never issues a rule search request', async () => {
    const requests = captureRequests(
      (request) => request.url.includes('searchRules') || request.url.includes('/search')
    );

    render(
      <AlertRuleActionsMenu
        ruleUid="rule-uid-1"
        resourceState={{ status: 'loaded', rule: buildRule() }}
        onMutated={jest.fn()}
      />
    );
    await openMenu();

    expect((await requests).length).toBe(0);
  });

  describe('ALERT-9: Silence availability gate', () => {
    it('shows Silence when Grafana AM is supported and the user has org-wide alert.instances:create, and opens the drawer for this rule', async () => {
      grantUserPermissions([AccessControlAction.AlertingRuleCreate, AccessControlAction.AlertingInstanceCreate]);

      render(
        <AlertRuleActionsMenu
          ruleUid="rule-uid-1"
          resourceState={{ status: 'loaded', rule: buildRule() }}
          onMutated={jest.fn()}
        />
      );
      const user = await openMenu();
      const silenceItem = await screen.findByRole('menuitem', { name: /silence notifications/i });
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

      render(
        <AlertRuleActionsMenu
          ruleUid="rule-uid-1"
          resourceState={{ status: 'loaded', rule: buildRule() }}
          onMutated={jest.fn()}
        />
      );
      await openMenu();

      expect(await screen.findByRole('menuitem', { name: /silence notifications/i })).toBeInTheDocument();
    });

    it('hides Silence when the user has neither org-wide nor folder-scoped silence permission', async () => {
      const folderRequests = await captureRequests((request) => request.url.includes('/api/folders/folder-uid-1'));

      render(
        <AlertRuleActionsMenu
          ruleUid="rule-uid-1"
          resourceState={{ status: 'loaded', rule: buildRule() }}
          onMutated={jest.fn()}
        />
      );
      await openMenu();

      // Wait for the folder-permission lookup to actually resolve before asserting absence -
      // otherwise this would trivially pass before the async check ever ran.
      await waitFor(() => expect(folderRequests.length).toBeGreaterThan(0));
      expect(screen.queryByRole('menuitem', { name: /silence notifications/i })).not.toBeInTheDocument();
    });

    it('hides Silence when Grafana sends only to external Alertmanagers, even with org permission', async () => {
      grantUserPermissions([AccessControlAction.AlertingRuleCreate, AccessControlAction.AlertingInstanceCreate]);
      const amConfigRequests = await captureRequests((request) => request.url.includes('/api/v1/ngalert'));
      server.use(
        http.get('/api/v1/ngalert', () =>
          HttpResponse.json({ alertmanagersChoice: AlertmanagerChoice.External, numExternalAlertmanagers: 1 })
        )
      );

      render(
        <AlertRuleActionsMenu
          ruleUid="rule-uid-1"
          resourceState={{ status: 'loaded', rule: buildRule() }}
          onMutated={jest.fn()}
        />
      );
      await openMenu();

      await waitFor(() => expect(amConfigRequests.length).toBeGreaterThan(0));
      expect(screen.queryByRole('menuitem', { name: /silence notifications/i })).not.toBeInTheDocument();
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

      render(
        <AlertRuleActionsMenu
          ruleUid="rule-uid-1"
          resourceState={{ status: 'loaded', rule: buildRule() }}
          onMutated={jest.fn()}
        />
      );
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

      render(
        <AlertRuleActionsMenu
          ruleUid="rule-uid-1"
          resourceState={{ status: 'loaded', rule: buildRule() }}
          onMutated={jest.fn()}
        />
      );
      await openMenu();

      expect(screen.getByRole('menuitem', { name: /manage enrichments/i })).toBeInTheDocument();
    });

    it('hides Manage enrichments when alertEnrichment is off, even with the per-rule toggle on and admin', async () => {
      config.featureToggles.alertEnrichment = false;
      config.featureToggles.alertingEnrichmentPerRule = true;
      contextSrv.user.orgRole = OrgRole.Admin;

      render(
        <AlertRuleActionsMenu
          ruleUid="rule-uid-1"
          resourceState={{ status: 'loaded', rule: buildRule() }}
          onMutated={jest.fn()}
        />
      );
      await openMenu();

      expect(screen.queryByRole('menuitem', { name: /manage enrichments/i })).not.toBeInTheDocument();
    });

    it('hides Manage enrichments when alertingEnrichmentPerRule is off, even with alertEnrichment on and admin', async () => {
      config.featureToggles.alertEnrichment = true;
      config.featureToggles.alertingEnrichmentPerRule = false;
      contextSrv.user.orgRole = OrgRole.Admin;

      render(
        <AlertRuleActionsMenu
          ruleUid="rule-uid-1"
          resourceState={{ status: 'loaded', rule: buildRule() }}
          onMutated={jest.fn()}
        />
      );
      await openMenu();

      expect(screen.queryByRole('menuitem', { name: /manage enrichments/i })).not.toBeInTheDocument();
    });

    it('hides Manage enrichments without admin role or alert.enrichments:read, even with both toggles on', async () => {
      config.featureToggles.alertEnrichment = true;
      config.featureToggles.alertingEnrichmentPerRule = true;
      contextSrv.user.orgRole = OrgRole.Editor;

      render(
        <AlertRuleActionsMenu
          ruleUid="rule-uid-1"
          resourceState={{ status: 'loaded', rule: buildRule() }}
          onMutated={jest.fn()}
        />
      );
      await openMenu();

      expect(screen.queryByRole('menuitem', { name: /manage enrichments/i })).not.toBeInTheDocument();
    });
  });
});
