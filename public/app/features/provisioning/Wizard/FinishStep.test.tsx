import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { FinishStep } from './FinishStep';
import { StepStatusProvider } from './StepStatusContext';
import { type WizardFormData } from './types';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetFrontendSettingsQuery: jest.fn(),
}));

jest.mock('../GettingStarted/features', () => ({
  checkImageRenderer: jest.fn(() => true),
  checkImageRenderingAllowed: jest.fn(() => true),
  checkPublicAccess: jest.fn(() => true),
}));

const mockUseGetFrontendSettingsQuery = useGetFrontendSettingsQuery as jest.MockedFunction<
  typeof useGetFrontendSettingsQuery
>;

type WizardFormDefaults = Omit<Partial<WizardFormData>, 'repository'> & {
  repository?: Partial<WizardFormData['repository']>;
};

function FormWrapper({ children, defaultValues }: { children: ReactNode; defaultValues?: WizardFormDefaults }) {
  const methods = useForm<WizardFormData>({
    defaultValues: {
      repository: {
        type: 'github',
        url: 'https://github.com/test/repo',
        title: '',
        sync: { target: 'folder', enabled: true, intervalSeconds: 60 },
        branch: 'main',
        path: '',
        readOnly: false,
        prWorkflow: false,
        ...defaultValues?.repository,
      },
      ...defaultValues,
    },
  });

  return (
    <FormProvider {...methods}>
      <StepStatusProvider>{children}</StepStatusProvider>
    </FormProvider>
  );
}

function setup(formDefaultValues?: WizardFormDefaults) {
  const user = userEvent.setup();
  const utils = render(
    <FormWrapper defaultValues={formDefaultValues}>
      <FinishStep />
    </FormWrapper>
  );
  return { user, ...utils };
}

describe('FinishStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGetFrontendSettingsQuery.mockReturnValue({
      data: { allowImageRendering: true },
      isLoading: false,
      refetch: jest.fn(),
    } as ReturnType<typeof useGetFrontendSettingsQuery>);
  });

  describe('GPG signing key section', () => {
    it('renders signing key, author name, and author email fields for github', () => {
      setup();
      expect(screen.getByText('GPG signing key')).toBeInTheDocument();
      expect(screen.getByLabelText(/Commit author name/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Commit author email/)).toBeInTheDocument();
    });

    it('disables author fields when no signing key is set', () => {
      setup();
      expect(screen.getByLabelText(/Commit author name/)).toBeDisabled();
      expect(screen.getByLabelText(/Commit author email/)).toBeDisabled();
    });

    it('enables author fields after a signing key is entered', async () => {
      const { user } = setup();
      await user.type(screen.getByLabelText(/GPG signing key/), 'PGP-KEY');
      expect(screen.getByLabelText(/Commit author name/)).toBeEnabled();
      expect(screen.getByLabelText(/Commit author email/)).toBeEnabled();
    });

    it('does not render signing key section for local repositories', () => {
      setup({ repository: { type: 'local', path: '/var/repos' } });
      expect(screen.queryByText('GPG signing key')).not.toBeInTheDocument();
    });
  });
});
