import { HttpResponse, http } from 'msw';
import { render, screen, waitFor, within } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { locationService, reportInteraction } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { type AdminConfigPostState, setupAdminConfigPost } from '../../mocks/server/configure/admin_config';

import { ImportWizardGate } from './ImportToGMA';

// Spread requireActual so config/locationService/feature-toggle reads stay real; only stub the
// analytics sink so we can assert the reported payload.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

// Selects which fixture the mocked Step1Content below seeds. Prefixed `mock` per Jest's rule for
// variables referenced from inside a jest.mock factory. Each describe block resets it in its own setup.
let mockScenario: 'yaml' | 'auto-sync' = 'yaml';

// Seeds either a valid YAML notifications source (config + policy tree name + template files, dry-run
// triggered) or an Auto-sync-checked data source (dry-run never runs for that path). Next is gated on a
// passing dry-run for the YAML fixture, so the policy tree name and the onTriggerDryRun call are both
// required for the wizard to advance there. The real step body pulls in network-backed pickers we don't
// need — the assertion target is handleConfirmImport's behavior, not the step UI.
jest.mock('./steps/Step1AlertmanagerResources', () => {
  const { useEffect } = require('react');
  const { useFormContext } = require('react-hook-form');
  return {
    Step1Content: function Step1Content({ onTriggerDryRun }: { onTriggerDryRun?: () => void }) {
      const { setValue } = useFormContext();
      useEffect(() => {
        if (mockScenario === 'auto-sync') {
          setValue('notificationsSource', 'datasource');
          setValue('notificationsDatasourceUID', 'mimir-uid');
          setValue('notificationsDatasourceName', 'Mimir Alertmanager');
          setValue('autoSyncNotificationsEnabled', true);
          return;
        }
        setValue('notificationsSource', 'yaml');
        setValue('policyTreeName', 'prometheus-prod');
        setValue(
          'notificationsYamlFile',
          new File(['route:\n  receiver: default\nreceivers:\n  - name: default\n'], 'alertmanager.yaml', {
            type: 'application/yaml',
          })
        );
        setValue('notificationsTemplateFiles', [
          new File(['{{ define "email" }}{{ end }}'], 'email.tmpl', { type: 'text/plain' }),
          new File(['{{ define "slack" }}{{ end }}'], 'slack.tmpl', { type: 'text/plain' }),
        ]);
        // Mounting on the wizard's very first render (Notifications is now step one), these setValue
        // calls aren't guaranteed to be visible via getValues() yet within the same tick — defer so
        // handleTriggerDryRun reads the values above rather than the stale defaults.
        queueMicrotask(() => onTriggerDryRun?.());
      }, [setValue, onTriggerDryRun]);
      return null;
    },
    useStep1Validation: () => true,
  };
});
// Rules step is skipped in these flows, so its body never renders a network call.
jest.mock('./steps/Step2AlertRules', () => ({
  Step2Content: () => null,
  useStep2Validation: () => true,
}));

const CONVERT_URL = '/api/convert/api/v1/alerts';

const server = setupMswServer();

const mockReportInteraction = jest.mocked(reportInteraction);

beforeEach(() => {
  mockReportInteraction.mockClear();
  // Default: the notifications import succeeds. Individual tests override this to force a failure.
  server.use(http.post(CONVERT_URL, () => HttpResponse.json({ status: 'success' })));
  grantUserPermissions([
    AccessControlAction.AlertingNotificationsWrite,
    AccessControlAction.AlertingRuleCreate,
    AccessControlAction.AlertingProvisioningSetStatus,
  ]);
  locationService.push('/');
});

/**
 * Drives the wizard: complete the notifications step, skip the rules step, then open and accept the
 * confirm modal. Leaves the rest to the caller's assertions.
 */
async function importWith(user: ReturnType<typeof render>['user']) {
  await screen.findByRole('group', { name: /import notification resources/i });
  // Notifications -> Rules: the stub triggers a dry-run; wait for it to pass so Next is enabled
  // (Next is gated on a passing dry-run, and is disabled while blocked). Re-query each poll — the
  // button node is replaced when its disabled-state tooltip wrapper is removed on enable.
  await waitFor(
    () =>
      expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
        'aria-disabled',
        'false'
      ),
    {
      timeout: 3000,
    }
  );
  await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
  await screen.findByRole('group', { name: /import alert rules/i });
  // Skip Rules -> Review
  await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.skipButton));
  // Review -> open confirm modal
  await user.click(await screen.findByRole('button', { name: /start import/i }));
  // Confirm inside the modal
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: /start import/i }));
}

describe('ImportToGMA wizard — stage analytics', () => {
  it('tracks success and lands on the Import settings tab', async () => {
    const { user } = render(<ImportWizardGate />);

    await importWith(user);

    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith(
        'grafana_alerting_import_to_gma_success',
        expect.objectContaining({ notificationsSource: 'yaml' })
      )
    );
    await waitFor(() => expect(locationService.getLocation().pathname).toContain('/alerting/admin/import'), {
      timeout: 3000,
    });
  });

  it('tracks an error when the import fails', async () => {
    // Only fail the real import — the dry-run (same URL, distinguished by the dry-run header) must
    // still pass so the wizard can advance to the confirm step under the passing-dry-run gate.
    server.use(
      http.post(CONVERT_URL, ({ request }) =>
        request.headers.get('X-Grafana-Alerting-Dry-Run') === 'true'
          ? HttpResponse.json({ status: 'success' })
          : new HttpResponse(null, { status: 500 })
      )
    );
    const { user } = render(<ImportWizardGate />);

    await importWith(user);

    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith(
        'grafana_alerting_import_to_gma_error',
        expect.objectContaining({ notificationsSource: 'yaml' })
      )
    );
    expect(mockReportInteraction).not.toHaveBeenCalledWith('grafana_alerting_import_to_gma_success', expect.anything());
    expect(locationService.getLocation().pathname).not.toContain('/alerting/list');
  });
});

describe('ImportToGMA wizard — step 1 dry-run gating & review', () => {
  it('keeps the notifications-step Next disabled when the dry-run fails', async () => {
    // Fail the dry-run itself, so the step never reaches a passing validation state.
    server.use(
      http.post(CONVERT_URL, ({ request }) =>
        request.headers.get('X-Grafana-Alerting-Dry-Run') === 'true'
          ? new HttpResponse(null, { status: 500 })
          : HttpResponse.json({ status: 'success' })
      )
    );
    const { user } = render(<ImportWizardGate />);

    await screen.findByRole('group', { name: /import notification resources/i });

    // The dry-run runs and fails; Next stays disabled (aria-disabled keeps the tooltip reachable).
    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith('grafana_alerting_import_to_gma_dryrun_error')
    );
    const nextButton = screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton);
    expect(nextButton).toHaveAttribute('aria-disabled', 'true');

    // Clicking a blocked Next must not advance to the rules step.
    await user.click(nextButton);
    expect(screen.queryByRole('group', { name: /import alert rules/i })).not.toBeInTheDocument();
  });

  it('lists the uploaded template files in the review step', async () => {
    const { user } = render(<ImportWizardGate />);

    await screen.findByRole('group', { name: /import notification resources/i });
    // Notifications -> Rules (wait for the seeded dry-run to pass; re-query — the button node is
    // replaced when its disabled-state tooltip wrapper is removed on enable).
    await waitFor(
      () =>
        expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
          'aria-disabled',
          'false'
        ),
      {
        timeout: 3000,
      }
    );
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByRole('group', { name: /import alert rules/i });
    // Skip Rules -> Review
    await user.click(await screen.findByTestId(selectors.pages.Alerting.ImportToGMA.skipButton));

    // The review notifications card lists the uploaded template files by name.
    expect(await screen.findByText('email.tmpl, slack.tmpl')).toBeInTheDocument();
  });
});

describe('ImportToGMA wizard — auto-sync confirm flow', () => {
  beforeEach(() => {
    mockScenario = 'auto-sync';
  });

  afterEach(() => {
    mockScenario = 'yaml';
  });

  /** Notifications -> Review, skipping Rules (force-skipped while Auto-sync is checked). */
  async function advanceToReview(user: ReturnType<typeof render>['user']) {
    await screen.findByRole('group', { name: /import notification resources/i });
    await waitFor(() =>
      expect(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton)).toHaveAttribute(
        'aria-disabled',
        'false'
      )
    );
    await user.click(screen.getByTestId(selectors.pages.Alerting.ImportToGMA.nextButton));
    await screen.findByText(/review import/i);
  }

  it('skips the Rules step entirely and lands on Review', async () => {
    const { user } = render(<ImportWizardGate />);

    await advanceToReview(user);

    expect(screen.queryByRole('group', { name: /import alert rules/i })).not.toBeInTheDocument();
    expect(screen.getByText(/will sync continuously/i)).toBeInTheDocument();
  });

  it('calls saveAutoSync (not the staging import) and tracks success on confirm', async () => {
    const postState: AdminConfigPostState = { lastPayload: null };
    setupAdminConfigPost(server, postState, 200);
    let stagingImportCalled = false;
    server.use(
      http.post(CONVERT_URL, () => {
        stagingImportCalled = true;
        return HttpResponse.json({ status: 'success' });
      })
    );

    const { user } = render(<ImportWizardGate />);
    await advanceToReview(user);

    await user.click(screen.getByRole('button', { name: /enable auto-sync/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /enable auto-sync/i }));

    await waitFor(() => expect(postState.lastPayload).toEqual({ external_alertmanager_uid: 'mimir-uid' }));
    expect(stagingImportCalled).toBe(false);
    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith(
        'grafana_alerting_import_to_gma_success',
        expect.objectContaining({ notificationsSource: 'datasource' })
      )
    );
    await waitFor(() => expect(locationService.getLocation().pathname).toContain('/alerting/admin/import'), {
      timeout: 3000,
    });
  });

  it('tracks an error and does not fall through to the staging import path when saveAutoSync fails', async () => {
    const postState: AdminConfigPostState = { lastPayload: null };
    setupAdminConfigPost(server, postState, 500);

    const { user } = render(<ImportWizardGate />);
    await advanceToReview(user);

    await user.click(screen.getByRole('button', { name: /enable auto-sync/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /enable auto-sync/i }));

    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith(
        'grafana_alerting_import_to_gma_error',
        expect.objectContaining({ notificationsSource: 'datasource' })
      )
    );
    expect(mockReportInteraction).not.toHaveBeenCalledWith('grafana_alerting_import_to_gma_success', expect.anything());
    expect(within(dialog).getByText(/failed to enable auto-sync/i)).toBeInTheDocument();
  });
});
