import { HttpResponse, http } from 'msw';
import { render, screen, waitFor, within } from 'test/test-utils';

import { locationService, reportInteraction } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';

import { ImportWizardGate } from './ImportToGMA';

// Spread requireActual so config/locationService/feature-toggle reads stay real; only stub the
// analytics sink so we can assert the reported payload.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

// Seed a valid YAML notifications source (config + policy tree name + template files) and trigger the
// dry-run, so the step reaches a passing validation state. Next is gated on a passing dry-run, so the
// policy tree name and the onTriggerDryRun call are both required for the wizard to advance. The real
// step body pulls in network-backed pickers we don't need — the assertion target is
// handleConfirmImport's tracking payload, not the step UI.
jest.mock('./steps/Step1AlertmanagerResources', () => {
  const { useEffect } = require('react');
  const { useFormContext } = require('react-hook-form');
  return {
    Step1Content: function Step1Content({ onTriggerDryRun }: { onTriggerDryRun?: () => void }) {
      const { setValue } = useFormContext();
      useEffect(() => {
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
        onTriggerDryRun?.();
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
 * Drives the wizard: pick the method, complete the notifications step, skip the rules step, then
 * open and accept the confirm modal. Leaves the rest to the caller's assertions.
 */
async function importWith(method: 'stage' | 'promote', user: ReturnType<typeof render>['user']) {
  if (method === 'promote') {
    await user.click(await screen.findByRole('radio', { name: /promote/i }));
  }
  // Method -> Notifications
  await user.click(await screen.findByTestId('wizard-next-button'));
  await screen.findByRole('group', { name: /import notification resources/i });
  // Notifications -> Rules: the stub triggers a dry-run; wait for it to pass so Next is enabled
  // (Next is gated on a passing dry-run, and is disabled while blocked). Re-query each poll — the
  // button node is replaced when its disabled-state tooltip wrapper is removed on enable.
  await waitFor(() => expect(screen.getByTestId('wizard-next-button')).toHaveAttribute('aria-disabled', 'false'), {
    timeout: 3000,
  });
  await user.click(screen.getByTestId('wizard-next-button'));
  await screen.findByRole('group', { name: /import alert rules/i });
  // Skip Rules -> Review
  await user.click(await screen.findByTestId('wizard-skip-button'));
  // Review -> open confirm modal
  await user.click(await screen.findByRole('button', { name: /start import/i }));
  // Confirm inside the modal
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: /start import/i }));
}

describe('ImportToGMA wizard — stage/promote analytics', () => {
  it.each(['stage', 'promote'] as const)('tracks success with importMethod=%s', async (method) => {
    const { user } = render(<ImportWizardGate />);

    await importWith(method, user);

    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith(
        'grafana_alerting_import_to_gma_success',
        expect.objectContaining({ importMethod: method })
      )
    );
    await waitFor(() => expect(locationService.getLocation().pathname).toContain('/alerting/list'), { timeout: 3000 });
  });

  it('tracks an error with importMethod when the import fails', async () => {
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

    await importWith('stage', user);

    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith(
        'grafana_alerting_import_to_gma_error',
        expect.objectContaining({ importMethod: 'stage' })
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

    // Method -> Notifications
    await user.click(await screen.findByTestId('wizard-next-button'));
    await screen.findByRole('group', { name: /import notification resources/i });

    // The dry-run runs and fails; Next stays disabled (aria-disabled keeps the tooltip reachable).
    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith('grafana_alerting_import_to_gma_dryrun_error')
    );
    const nextButton = screen.getByTestId('wizard-next-button');
    expect(nextButton).toHaveAttribute('aria-disabled', 'true');

    // Clicking a blocked Next must not advance to the rules step.
    await user.click(nextButton);
    expect(screen.queryByRole('group', { name: /import alert rules/i })).not.toBeInTheDocument();
  });

  it('lists the uploaded template files in the review step', async () => {
    const { user } = render(<ImportWizardGate />);

    // Method -> Notifications
    await user.click(await screen.findByTestId('wizard-next-button'));
    await screen.findByRole('group', { name: /import notification resources/i });
    // Notifications -> Rules (wait for the seeded dry-run to pass; re-query — the button node is
    // replaced when its disabled-state tooltip wrapper is removed on enable).
    await waitFor(() => expect(screen.getByTestId('wizard-next-button')).toHaveAttribute('aria-disabled', 'false'), {
      timeout: 3000,
    });
    await user.click(screen.getByTestId('wizard-next-button'));
    await screen.findByRole('group', { name: /import alert rules/i });
    // Skip Rules -> Review
    await user.click(await screen.findByTestId('wizard-skip-button'));

    // The review notifications card lists the uploaded template files by name.
    expect(await screen.findByText('email.tmpl, slack.tmpl')).toBeInTheDocument();
  });
});
