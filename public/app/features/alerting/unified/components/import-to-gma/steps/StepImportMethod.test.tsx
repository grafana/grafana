import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, testWithFeatureToggles, waitFor } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserRole } from 'app/features/alerting/unified/mocks';
import {
  setupAdminConfigGet,
  setupAlertmanagersStatus,
} from 'app/features/alerting/unified/mocks/server/configure/admin_config';
import {
  mimirAlertmanagerDataSourcePayload,
  setupDatasourcesEndpoint,
} from 'app/features/alerting/unified/mocks/server/configure/datasources';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';

import { type ImportFormValues } from '../ImportToGMA';
import { StepperStateProvider } from '../Wizard/StepperState';
import { type ImportMethod, StepKey } from '../Wizard/types';

import { StepImportMethod } from './StepImportMethod';

const server = setupMswServer();

const MIMIR_DS_NAME = 'Test Mimir Alertmanager';

function renderStep(method: ImportMethod = 'stage') {
  function Wrapper() {
    const formAPI = useForm<ImportFormValues>({ defaultValues: { importMethod: method } });
    return (
      <FormProvider {...formAPI}>
        <StepperStateProvider initialStep={StepKey.Method}>
          <StepImportMethod onNext={() => true} onCancel={jest.fn()} />
        </StepperStateProvider>
      </FormProvider>
    );
  }
  return render(<Wrapper />);
}

const ui = {
  stageRadio: byRole('radio', { name: /stage/i }),
  autosyncRadio: byRole('radio', { name: /auto-sync/i }),
  nextButton: byRole('button', { name: /notification resources|review & enable/i }),
  picker: byRole('combobox'),
  promoteWarning: byText(/promoting can't be undone/i),
  noDatasources: byText(/no mimir or cortex data sources/i),
};

describe('StepImportMethod — segment panels', () => {
  it('shows the Stage description when Stage is selected', () => {
    renderStep('stage');
    expect(screen.getByText(/stage brings the config in safely/i)).toBeInTheDocument();
    expect(ui.promoteWarning.query()).not.toBeInTheDocument();
  });

  it('shows the irreversible-merge warning when Promote is selected', () => {
    renderStep('promote');
    expect(ui.promoteWarning.get()).toBeInTheDocument();
  });
});

describe('StepImportMethod — Auto-sync segment gating', () => {
  it('hides the Auto-sync segment when the feature flag is off', () => {
    grantUserRole('Admin');
    renderStep('stage');
    expect(ui.stageRadio.get()).toBeInTheDocument();
    expect(ui.autosyncRadio.query()).not.toBeInTheDocument();
  });

  describe('with the feature flag on', () => {
    testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

    it('hides the Auto-sync segment for non-admins', () => {
      grantUserRole('Editor');
      renderStep('stage');
      expect(ui.autosyncRadio.query()).not.toBeInTheDocument();
    });

    it('shows the Auto-sync segment for org admins', () => {
      grantUserRole('Admin');
      renderStep('stage');
      expect(ui.autosyncRadio.get()).toBeInTheDocument();
    });
  });
});

describe('StepImportMethod — option order', () => {
  it('renders Stage then Promote when Auto-sync is unavailable', () => {
    grantUserRole('Admin');
    renderStep('stage');
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios[0]).toHaveAccessibleName('Stage');
    expect(radios[1]).toHaveAccessibleName('Promote');
  });

  describe('with the feature flag on', () => {
    testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

    it('renders Stage, then Promote, then Auto-sync for org admins', () => {
      grantUserRole('Admin');
      renderStep('stage');
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);
      expect(radios[0]).toHaveAccessibleName('Stage');
      expect(radios[1]).toHaveAccessibleName('Promote');
      expect(radios[2]).toHaveAccessibleName('Auto-sync');
    });
  });
});

describe('StepImportMethod — Auto-sync panel', () => {
  testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

  beforeEach(() => {
    grantUserRole('Admin');
    setupAlertmanagersStatus(server);
  });

  it('lists only Mimir/Cortex data sources and blocks Next until one is selected', async () => {
    setupAdminConfigGet(server, { alertmanagersChoice: AlertmanagerChoice.Internal });
    setupDatasourcesEndpoint(server, [mimirAlertmanagerDataSourcePayload({ name: MIMIR_DS_NAME })]);

    const { user } = renderStep('autosync');

    expect(await ui.picker.find()).toBeInTheDocument();
    expect(ui.nextButton.get()).toBeDisabled();

    await user.click(ui.picker.get());
    await user.click(await screen.findByText(MIMIR_DS_NAME));

    await waitFor(() => expect(ui.nextButton.get()).toBeEnabled());
  });

  it('shows an empty state when there are no Mimir/Cortex data sources', async () => {
    setupAdminConfigGet(server, { alertmanagersChoice: AlertmanagerChoice.Internal });
    setupDatasourcesEndpoint(server, []);

    renderStep('autosync');

    expect(await ui.noDatasources.find()).toBeInTheDocument();
    expect(ui.nextButton.get()).toBeDisabled();
  });
});
