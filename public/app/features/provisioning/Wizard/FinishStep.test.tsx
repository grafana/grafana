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

  describe('signing key section', () => {
    const expandCommitOptions = (user: ReturnType<typeof userEvent.setup>) =>
      user.click(screen.getByText('Commit options (advanced)'));

    it('renders the signing format selector for github with signing off by default', async () => {
      const { user } = setup();
      await expandCommitOptions(user);
      expect(screen.getByText('Commit signing')).toBeInTheDocument();
      expect(screen.queryByLabelText(/Signing key/)).not.toBeInTheDocument();
    });

    it('reveals signing key and author fields after a format is selected', async () => {
      const { user } = setup();
      await expandCommitOptions(user);
      await user.click(screen.getByLabelText('GPG'));
      expect(screen.getByLabelText(/Signing key/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Signer name/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Signer email/)).toBeInTheDocument();
    });

    it('shows the S/MIME certificate field only for the smime format', async () => {
      const { user } = setup();
      await expandCommitOptions(user);
      await user.click(screen.getByLabelText('GPG'));
      expect(screen.queryByLabelText(/S\/MIME certificate/)).not.toBeInTheDocument();
      await user.click(screen.getByLabelText('S/MIME'));
      expect(screen.getByLabelText(/S\/MIME certificate/)).toBeInTheDocument();
    });

    it('does not render the signing section for local repositories', () => {
      setup({ repository: { type: 'local', path: '/var/repos' } });
      expect(screen.queryByText('Commit signing')).not.toBeInTheDocument();
    });
  });
});
