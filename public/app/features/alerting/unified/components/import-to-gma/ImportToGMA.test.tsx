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

// Seed a valid YAML notifications source so the real useImportNotifications resolves and posts to
// the convert endpoint (mocked with MSW below). The real step body pulls in network-backed pickers
// we don't need — the assertion target is handleConfirmImport's tracking payload, not the step UI.
jest.mock('./steps/Step1AlertmanagerResources', () => {
  const { useEffect } = require('react');
  const { useFormContext } = require('react-hook-form');
  return {
    Step1Content: function Step1Content() {
      const { setValue } = useFormContext();
      useEffect(() => {
        setValue('notificationsSource', 'yaml');
        setValue(
          'notificationsYamlFile',
          new File(['route:\n  receiver: default\nreceivers:\n  - name: default\n'], 'alertmanager.yaml', {
            type: 'application/yaml',
          })
        );
      }, [setValue]);
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
  // Notifications -> Rules (Step1Content is stubbed; it seeds a YAML source and validation is forced true)
  await user.click(await screen.findByTestId('wizard-next-button'));
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
    server.use(http.post(CONVERT_URL, () => new HttpResponse(null, { status: 500 })));
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
