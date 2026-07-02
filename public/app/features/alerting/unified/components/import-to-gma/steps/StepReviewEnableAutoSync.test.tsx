import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, waitFor } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { locationService } from '@grafana/runtime';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserRole } from 'app/features/alerting/unified/mocks';
import {
  type AdminConfigPostState,
  setupAlertmanagersStatus,
  setupStatefulAdminConfig,
} from 'app/features/alerting/unified/mocks/server/configure/admin_config';
import { setupDatasourcesEndpoint } from 'app/features/alerting/unified/mocks/server/configure/datasources';

import { type ImportFormValues } from '../ImportToGMA';
import { StepperStateProvider, useStepperState } from '../Wizard/StepperState';
import { StepKey } from '../Wizard/types';

import { StepReviewEnableAutoSync } from './StepReviewEnableAutoSync';

const server = setupMswServer();

const MIMIR_DS_UID = 'mimir-uid';
const MIMIR_DS_NAME = 'Test Mimir Alertmanager';
const MIMIR_DS_PAYLOAD = {
  id: 1,
  uid: MIMIR_DS_UID,
  orgId: 1,
  name: MIMIR_DS_NAME,
  type: 'alertmanager',
  url: 'http://localhost:9009',
  jsonData: { implementation: 'mimir' },
};

const postState: AdminConfigPostState = { lastPayload: null };

beforeEach(() => {
  postState.lastPayload = null;
  grantUserRole('Admin');
  setupAlertmanagersStatus(server);
  setupStatefulAdminConfig(server, postState);
  setupDatasourcesEndpoint(server, [MIMIR_DS_PAYLOAD]);
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

  it('enables auto-sync by posting the selected source and navigates to the alert rules list', async () => {
    const { user } = renderStep();

    await waitFor(() => expect(ui.enableButton.get()).toBeEnabled());
    await user.click(ui.enableButton.get());

    await waitFor(() => expect(postState.lastPayload).toEqual({ external_alertmanager_uid: MIMIR_DS_UID }));
    await waitFor(() => expect(locationService.getLocation().pathname).toContain('/alerting/list'), { timeout: 3000 });
  });

  it('returns to the method step when Back is clicked', async () => {
    const { user } = renderStep();

    await user.click(await ui.backButton.find());

    expect(screen.getByTestId('active-step')).toHaveTextContent(StepKey.Method);
  });
});
