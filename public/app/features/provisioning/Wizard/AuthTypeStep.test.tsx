import { type ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, waitFor } from 'test/test-utils';

import { setupProvisioningMswServer } from '../mocks/server';

import { AuthTypeStep } from './AuthTypeStep';
import { type WizardFormData } from './types';

setupProvisioningMswServer();

jest.mock('../hooks/useConnectionStatus', () => ({
  useConnectionStatus: jest.fn(() => ({ isConnected: true })),
}));

jest.mock('./AppConnectionFields', () => {
  const React = jest.requireActual('react');
  return {
    AppConnectionFields: ({ onAuthorizingChange }: { onAuthorizingChange: (isAuthorizing: boolean) => void }) => {
      React.useEffect(() => {
        onAuthorizingChange(true);
      }, [onAuthorizingChange]);
      return React.createElement('div', null, 'GitHub App configuration');
    },
  };
});

jest.mock('./components/RepositoryField', () => {
  const React = jest.requireActual('react');
  return {
    RepositoryField: () => React.createElement('div', null, 'Repository URL'),
  };
});

jest.mock('./components/RepositoryTokenInput', () => {
  const React = jest.requireActual('react');
  return {
    RepositoryTokenInput: () => React.createElement('div', null, 'Token input'),
  };
});

function FormWrapper({ children, defaultValues }: { children: ReactNode; defaultValues?: Partial<WizardFormData> }) {
  const methods = useForm<WizardFormData>({
    defaultValues: {
      repository: { type: 'github' },
      githubAuthType: 'github-app',
      githubAppMode: 'existing',
      githubApp: { connectionName: 'github-app' },
      ...defaultValues,
    },
  });

  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe('AuthTypeStep', () => {
  it('shows GitHub App configuration before the repository URL', async () => {
    render(
      <FormWrapper>
        <AuthTypeStep onGitHubAppSubmit={jest.fn()} />
      </FormWrapper>
    );

    const githubAppConfiguration = await screen.findByText('GitHub App configuration');
    const repositoryUrl = screen.getByText('Repository URL');

    expect(
      githubAppConfiguration.compareDocumentPosition(repositoryUrl) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('shows the repository URL before the token input for PAT auth', async () => {
    render(
      <FormWrapper defaultValues={{ githubAuthType: 'pat' }}>
        <AuthTypeStep onGitHubAppSubmit={jest.fn()} />
      </FormWrapper>
    );

    const repositoryUrl = await screen.findByText('Repository URL');
    const tokenInput = screen.getByText('Token input');

    expect(repositoryUrl.compareDocumentPosition(tokenInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('locks the authentication method radios while a connection authorization is pending', async () => {
    render(
      <FormWrapper>
        <AuthTypeStep onGitHubAppSubmit={jest.fn()} />
      </FormWrapper>
    );

    // The PAT radio renders before settings resolve; wait for the authorizing signal to propagate.
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /Connect with Personal Access Token/ })).toBeDisabled();
    });
    expect(screen.getByRole('radio', { name: /Connect with GitHub App/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Connect with OAuth App/ })).toBeDisabled();
  });
});
