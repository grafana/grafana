import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, testWithFeatureToggles, waitFor } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';

import { setupMswServer } from '../../mockApi';
import { grantUserRole } from '../../mocks';
import { setupAdminConfigGet, setupAlertmanagersStatus } from '../../mocks/server/configure/admin_config';
import { mimirAlertmanagerDataSourcePayload, setupDatasourcesEndpoint } from '../../mocks/server/configure/datasources';

import { type ImportFormValues, ImportWizardGate } from './ImportToGMA';
import { StepperStateProvider, useStepperState } from './Wizard/StepperState';
import { WizardStep } from './Wizard/WizardStep';
import { type ImportMethod, StepKey } from './Wizard/types';
import { StepImportMethod } from './steps/StepImportMethod';

const server = setupMswServer();

const MIMIR_DS_NAME = 'Test Mimir Alertmanager';

const ui = {
  stageRadio: byRole('radio', { name: /stage/i }),
  promoteRadio: byRole('radio', { name: /promote/i }),
  autosyncRadio: byRole('radio', { name: /auto-sync/i }),
  datasourcePicker: byRole('combobox'),
  // Method step: the Next button is labelled with the next step's name. Anchored so it matches
  // the Next button only, not the same-named step in the Stepper rail (which prefixes a number).
  toReviewEnable: byRole('button', { name: /^review & enable$/i }),
  toNotifications: byRole('button', { name: /notification resources/i }),
  // Auto-sync review step's own back button.
  backToMethodAutoSync: byRole('button', { name: /add method/i }),
  // Shared Wizard PreviousButton is labelled with the previous step's name.
  backToMethodShared: byRole('button', { name: /import method/i }),
  reviewEnableHeading: byText(/review & enable auto-sync/i),
  notificationsPlaceholder: byText('notifications-placeholder'),
};

describe('Import wizard navigation — auto-sync path (real wizard)', () => {
  testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

  beforeEach(() => {
    grantUserRole('Admin');
    setupAlertmanagersStatus(server);
    setupAdminConfigGet(server, { alertmanagersChoice: AlertmanagerChoice.Internal });
    setupDatasourcesEndpoint(server, [mimirAlertmanagerDataSourcePayload({ name: MIMIR_DS_NAME })]);
  });

  it('goes forward to Review & enable and back to the method step with the selection preserved', async () => {
    const { user } = render(<ImportWizardGate />);

    // Choose Auto-sync and pick the data source.
    await user.click(await ui.autosyncRadio.find());
    await user.click(await ui.datasourcePicker.find());
    await user.click(await screen.findByText(MIMIR_DS_NAME));

    // Forward: Method -> Review & enable.
    await waitFor(() => expect(ui.toReviewEnable.get()).toBeEnabled());
    await user.click(ui.toReviewEnable.get());
    expect(await ui.reviewEnableHeading.find()).toBeInTheDocument();

    // Back: Review & enable -> Method, with Auto-sync still selected.
    await user.click(ui.backToMethodAutoSync.get());
    expect(await ui.autosyncRadio.find()).toBeChecked();

    // The preserved data source selection lets us step straight forward again.
    await waitFor(() => expect(ui.toReviewEnable.get()).toBeEnabled());
    await user.click(ui.toReviewEnable.get());
    expect(await ui.reviewEnableHeading.find()).toBeInTheDocument();
  });
});

describe('Import wizard navigation — stage/promote back navigation', () => {
  // Stage/Promote use the shared Wizard PreviousButton (the auto-sync review step has its own
  // back button). This harness exercises the real StepImportMethod + Next/Previous buttons and
  // react-hook-form persistence without mounting the network-backed Notification resources step.
  function ActiveStepView() {
    const { activeStep } = useStepperState();
    if (activeStep === StepKey.Method) {
      return <StepImportMethod onNext={() => true} onCancel={jest.fn()} />;
    }
    if (activeStep === StepKey.Notifications) {
      return (
        <WizardStep stepId={StepKey.Notifications} label="Notification resources">
          <div>notifications-placeholder</div>
        </WizardStep>
      );
    }
    return null;
  }

  function renderHarness(method: ImportMethod) {
    function Wrapper() {
      const formAPI = useForm<ImportFormValues>({ defaultValues: { importMethod: method } });
      return (
        <FormProvider {...formAPI}>
          <StepperStateProvider initialStep={StepKey.Method}>
            <ActiveStepView />
          </StepperStateProvider>
        </FormProvider>
      );
    }
    return render(<Wrapper />);
  }

  it.each(['stage', 'promote'] as const)(
    'returns to the method step with %s still selected after going back',
    async (method) => {
      const { user } = renderHarness(method);
      const methodRadio = method === 'stage' ? ui.stageRadio : ui.promoteRadio;

      expect(methodRadio.get()).toBeChecked();

      // Forward into the (stubbed) Notification resources step.
      await user.click(ui.toNotifications.get());
      expect(ui.notificationsPlaceholder.get()).toBeInTheDocument();

      // Back to the method step via the shared Previous button.
      await user.click(ui.backToMethodShared.get());
      expect(methodRadio.get()).toBeChecked();
    }
  );
});
