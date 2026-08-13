import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, testWithFeatureToggles, waitFor } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { locationService, reportInteraction } from '@grafana/runtime';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions, grantUserRole } from 'app/features/alerting/unified/mocks';
import { setupAlertmanagersStatus } from 'app/features/alerting/unified/mocks/server/configure/alertmanagers';
import {
  mimirAlertmanagerDataSourcePayload,
  setupDatasourcesEndpoint,
} from 'app/features/alerting/unified/mocks/server/configure/datasources';
import {
  CONFIG_READ_FAILURE_MESSAGE,
  setupAutoSyncConfigAbsent,
  setupAutoSyncConfigReadError,
  setupAutoSyncConfigWriteError,
  setupStatefulAutoSyncConfig,
} from 'app/features/alerting/unified/mocks/server/handlers/k8s/config.k8s';
import { AccessControlAction } from 'app/types/accessControl';

import { type ImportFormValues } from '../ImportToGMA';
import { StepperStateProvider, useStepperState } from '../Wizard/StepperState';
import { StepKey } from '../Wizard/types';

import { StepReviewEnableAutoSync } from './StepReviewEnableAutoSync';

// Spread requireActual so locationService and config stay real; only stub the analytics sink.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const server = setupMswServer();

const MIMIR_DS_UID = 'mimir-uid';
const MIMIR_DS_NAME = 'Test Mimir Alertmanager';

const mockReportInteraction = jest.mocked(reportInteraction);

/** Set by beforeEach so each test asserts against its own stateful Config handler. */
let getStored: () => { spec: { externalAlertmanagerSync?: { datasourceUid?: string } } };

// This step is only reachable with the flag on, and useAutoSyncConfiguration skips its Config query
// without it.
testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

beforeEach(() => {
  mockReportInteraction.mockClear();
  // Known baseline so the "did not navigate" assertion is meaningful across tests.
  locationService.push('/');
  grantUserRole('Admin');
  grantUserPermissions([AccessControlAction.ActionAlertingNotificationsConfigRead]);
  setupAlertmanagersStatus(server);
  ({ getStored } = setupStatefulAutoSyncConfig(server));
  setupDatasourcesEndpoint(server, [mimirAlertmanagerDataSourcePayload({ uid: MIMIR_DS_UID, name: MIMIR_DS_NAME })]);
});

function ActiveStepProbe() {
  const { activeStep } = useStepperState();
  return <div data-testid="active-step">{activeStep}</div>;
}

function renderStep() {
  function Wrapper() {
    const formAPI = useForm<ImportFormValues>({
      defaultValues: { importMethod: 'autosync', autosyncDatasourceUID: MIMIR_DS_UID },
    });
    return (
      <FormProvider {...formAPI}>
        <StepperStateProvider initialStep={StepKey.ReviewEnable}>
          <ActiveStepProbe />
          <StepReviewEnableAutoSync onCancel={jest.fn()} />
        </StepperStateProvider>
      </FormProvider>
    );
  }
  return render(<Wrapper />);
}

const ui = {
  heading: byText(/review & enable auto-sync/i),
  enableButton: byRole('button', { name: /enable auto-sync/i }),
  backButton: byRole('button', { name: /add method/i }),
};

describe('StepReviewEnableAutoSync', () => {
  it('renders the summary with the selected source name', async () => {
    renderStep();

    expect(await ui.heading.find()).toBeInTheDocument();
    expect(await screen.findByText(MIMIR_DS_NAME)).toBeInTheDocument();
  });

  it('enables auto-sync by posting the selected source, tracks success and navigates to the alert rules list', async () => {
    const { user } = renderStep();

    // The UID comes from the form, so it is set on mount: without the isReady gate the button would
    // already be clickable here, while the Config read is still in flight.
    expect(ui.enableButton.get()).toBeDisabled();

    await waitFor(() => expect(ui.enableButton.get()).toBeEnabled());
    await user.click(ui.enableButton.get());

    await waitFor(() => expect(getStored().spec.externalAlertmanagerSync).toEqual({ datasourceUid: MIMIR_DS_UID }));
    await waitFor(() => expect(locationService.getLocation().pathname).toContain('/alerting/list'), { timeout: 3000 });

    expect(mockReportInteraction).toHaveBeenCalledWith('grafana_alerting_import_to_gma_success', {
      importMethod: 'autosync',
    });
  });

  it('never enables Enable while the Config singleton is unseeded, so a click cannot report a false failure', async () => {
    // Unlike the in-flight case above, the read settles with nothing, so a loading-only gate would
    // hand the user a permanently enabled button that can only fail. The tooltip explains the wait.
    setupAutoSyncConfigAbsent(server);
    const { user } = renderStep();

    expect(await screen.findByText(MIMIR_DS_NAME)).toBeInTheDocument();
    expect(ui.enableButton.get()).toBeDisabled();

    await user.click(ui.enableButton.get());

    expect(mockReportInteraction).not.toHaveBeenCalled();
    expect(locationService.getLocation().pathname).not.toContain('/alerting/list');
  });

  it('explains a failed Config read on the Enable tooltip instead of promising the wait is temporary', async () => {
    // Same gate as the unseeded case above, but a 500 is not something waiting out fixes, so the
    // tooltip has to say what actually happened.
    setupAutoSyncConfigReadError(server, { code: 500 });
    const { user } = renderStep();

    expect(await screen.findByText(MIMIR_DS_NAME)).toBeInTheDocument();
    expect(ui.enableButton.get()).toBeDisabled();
    // Absent until hovered, so the assertion below cannot pass on always-rendered copy.
    expect(screen.queryByText(/could not load the auto-sync configuration/i)).not.toBeInTheDocument();

    await user.hover(ui.enableButton.get());

    expect(
      await screen.findByText(`Could not load the auto-sync configuration: ${CONFIG_READ_FAILURE_MESSAGE}`)
    ).toBeInTheDocument();
  });

  it('tracks an import error and stays on the step when enabling fails', async () => {
    // Genuine failure — save() rejects, the shared hook shows its own error toast and resolves false.
    setupAutoSyncConfigWriteError(server, { code: 500, message: 'failed to save the configuration' });
    const { user } = renderStep();

    await waitFor(() => expect(ui.enableButton.get()).toBeEnabled());
    await user.click(ui.enableButton.get());

    await waitFor(() =>
      expect(mockReportInteraction).toHaveBeenCalledWith('grafana_alerting_import_to_gma_error', {
        importMethod: 'autosync',
      })
    );
    expect(mockReportInteraction).not.toHaveBeenCalledWith('grafana_alerting_import_to_gma_success', expect.anything());
    expect(locationService.getLocation().pathname).not.toContain('/alerting/list');
  });

  it('returns to the method step when Back is clicked', async () => {
    const { user } = renderStep();

    await user.click(await ui.backButton.find());

    expect(screen.getByTestId('active-step')).toHaveTextContent(StepKey.Method);
  });
});
