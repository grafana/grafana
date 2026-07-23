import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { AuthTypeStep } from './AuthTypeStep';
import { type WizardFormData } from './types';

jest.mock('../hooks/useConnectionStatus', () => ({
  useConnectionStatus: jest.fn(() => ({ isConnected: true })),
}));

jest.mock('./GitHubAppFields', () => {
  const React = jest.requireActual('react');
  return {
    GitHubAppFields: () => React.createElement('div', null, 'GitHub App configuration'),
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
  it('shows GitHub App configuration before the repository URL', () => {
    render(
      <FormWrapper>
        <AuthTypeStep onGitHubAppSubmit={jest.fn()} />
      </FormWrapper>
    );

    const githubAppConfiguration = screen.getByText('GitHub App configuration');
    const repositoryUrl = screen.getByText('Repository URL');

    expect(
      githubAppConfiguration.compareDocumentPosition(repositoryUrl) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('shows the repository URL before the token input for PAT auth', () => {
    render(
      <FormWrapper defaultValues={{ githubAuthType: 'pat' }}>
        <AuthTypeStep onGitHubAppSubmit={jest.fn()} />
      </FormWrapper>
    );

    const repositoryUrl = screen.getByText('Repository URL');
    const tokenInput = screen.getByText('Token input');

    expect(repositoryUrl.compareDocumentPosition(tokenInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
