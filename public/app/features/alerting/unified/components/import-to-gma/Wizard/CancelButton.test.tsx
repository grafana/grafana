import { createMemoryHistory } from 'history';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, userEvent } from 'test/test-utils';

import { locationService } from '@grafana/runtime';

import { ImportFormValues } from '../ImportToGMA';

import { CancelButton } from './CancelButton';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    push: jest.fn(),
    getHistory: jest.fn(),
  },
}));

interface WrapperProps {
  children: React.ReactNode;
  isDirty?: boolean;
}

function FormWrapper({ children, isDirty = false }: WrapperProps) {
  const formAPI = useForm<ImportFormValues>({
    defaultValues: {
      step1Completed: false,
      step1Skipped: false,
      step2Completed: false,
      step2Skipped: false,
      policyTreeName: '',
      notificationsSource: 'yaml',
      notificationsDatasourceUID: undefined,
      notificationsDatasourceName: null,
      notificationsYamlFile: null,
      notificationPolicyOption: 'default',
      manualLabelName: '',
      manualLabelValue: '',
      rulesSource: 'datasource',
      rulesDatasourceUID: undefined,
      rulesDatasourceName: null,
      rulesYamlFile: null,
      namespace: undefined,
      ruleGroup: undefined,
      targetFolder: undefined,
      pauseAlertingRules: true,
      pauseRecordingRules: true,
      targetDatasourceUID: undefined,
    },
  });

  // Simulate dirty state by setting a value if isDirty is true
  if (isDirty) {
    formAPI.setValue('policyTreeName', 'modified', { shouldDirty: true });
  }

  return <FormProvider {...formAPI}>{children}</FormProvider>;
}

describe('CancelButton', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    const history = createMemoryHistory();
    (locationService.getHistory as jest.Mock).mockReturnValue(history);
  });

  it('should render cancel button', () => {
    render(
      <FormWrapper>
        <CancelButton />
      </FormWrapper>
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should navigate immediately when form is not dirty', async () => {
    render(
      <FormWrapper isDirty={false}>
        <CancelButton />
      </FormWrapper>
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(locationService.push).toHaveBeenCalledWith('/alerting/list');
  });

  it('should show confirmation modal when form is dirty', async () => {
    render(
      <FormWrapper isDirty={true}>
        <CancelButton />
      </FormWrapper>
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('heading', { name: 'Cancel import?' })).toBeInTheDocument();
    expect(locationService.push).not.toHaveBeenCalled();
  });

  it('should navigate when user confirms cancellation', async () => {
    render(
      <FormWrapper isDirty={true}>
        <CancelButton />
      </FormWrapper>
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Discard changes' }));

    expect(locationService.push).toHaveBeenCalledWith('/alerting/list');
  });

  it('should use custom redirect URL', async () => {
    render(
      <FormWrapper isDirty={false}>
        <CancelButton redirectUrl="/custom/path" />
      </FormWrapper>
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(locationService.push).toHaveBeenCalledWith('/custom/path');
  });
});
