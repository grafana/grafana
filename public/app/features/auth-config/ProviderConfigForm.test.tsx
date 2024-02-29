import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { JSX } from 'react';

import { reportInteraction } from '@grafana/runtime';

import { ProviderConfigForm } from './ProviderConfigForm';
import { SSOProvider } from './types';
import { emptySettings } from './utils/data';

const putMock = jest.fn(() => Promise.resolve({}));
const deleteMock = jest.fn(() => Promise.resolve({}));

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({
    put: putMock,
    delete: deleteMock,
  }),
  config: {
    panels: {
      test: {
        id: 'test',
        name: 'test',
      },
    },
  },
  getAppEvents: () => ({
    publish: jest.fn(),
  }),
  isFetchError: () => true,
  locationService: {
    push: jest.fn(),
  },
  reportInteraction: jest.fn(),
}));

const reportInteractionMock = jest.mocked(reportInteraction);

// Mock the FormPrompt component as it requires Router setup to work
jest.mock('app/core/components/FormPrompt/FormPrompt', () => ({
  FormPrompt: () => <></>,
}));

const testConfig: SSOProvider = {
  id: '300f9b7c-0488-40db-9763-a22ce8bf6b3e',
  provider: 'github',
  source: 'database',
  settings: {
    ...emptySettings,
    name: 'GitHub',
    type: 'OAuth',
    clientId: '12345',
    clientSecret: 'abcde',
    enabled: true,
    teamIds: '',
    allowedOrganizations: '',
    allowedDomains: '',
    allowedGroups: '',
    scopes: '',
  },
};

const emptyConfig = {
  ...testConfig,
  settings: { ...testConfig.settings, enabled: false, clientId: '', clientSecret: '' },
};

function setup(jsx: JSX.Element) {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
}

describe('ProviderConfigForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all fields correctly', async () => {
    setup(<ProviderConfigForm config={testConfig} provider={testConfig.provider} />);
    expect(screen.getByRole('textbox', { name: /Client ID/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Team IDs/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Allowed organizations/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Discard/i })).toBeInTheDocument();
  });

  it('should save and enable on form submit', async () => {
    const { user } = setup(<ProviderConfigForm config={emptyConfig} provider={emptyConfig.provider} />);
    await user.type(screen.getByRole('textbox', { name: /Client ID/i }), 'test-client-id');
    await user.type(screen.getByLabelText(/Client secret/i), 'test-client-secret');
    // Type a team name and press enter to select it
    await user.type(screen.getByRole('combobox', { name: /Team IDs/i }), '12324{enter}');
    // Add two orgs
    await user.type(screen.getByRole('combobox', { name: /Allowed organizations/i }), 'test-org1{enter}');
    await user.type(screen.getByRole('combobox', { name: /Allowed organizations/i }), 'test-org2{enter}');
    await user.click(screen.getByRole('button', { name: /Save and enable/i }));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        '/api/v1/sso-settings/github',
        {
          id: '300f9b7c-0488-40db-9763-a22ce8bf6b3e',
          provider: 'github',
          settings: {
            name: 'GitHub',
            allowedOrganizations: 'test-org1,test-org2',
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            teamIds: '12324',
            enabled: true,
          },
        },
        { showErrorAlert: false }
      );

      expect(reportInteractionMock).toHaveBeenCalledWith('grafana_authentication_ssosettings_saved', {
        provider: 'github',
        enabled: true,
      });
    });
  });

  it('should save on form submit', async () => {
    const { user } = setup(<ProviderConfigForm config={emptyConfig} provider={emptyConfig.provider} />);
    await user.type(screen.getByRole('textbox', { name: /Client ID/i }), 'test-client-id');
    await user.type(screen.getByLabelText(/Client secret/i), 'test-client-secret');
    // Type a team name and press enter to select it
    await user.type(screen.getByRole('combobox', { name: /Team IDs/i }), '12324{enter}');
    // Add two orgs
    await user.type(screen.getByRole('combobox', { name: /Allowed organizations/i }), 'test-org1{enter}');
    await user.type(screen.getByRole('combobox', { name: /Allowed organizations/i }), 'test-org2{enter}');
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        '/api/v1/sso-settings/github',
        {
          id: '300f9b7c-0488-40db-9763-a22ce8bf6b3e',
          provider: 'github',
          settings: {
            name: 'GitHub',
            allowedOrganizations: 'test-org1,test-org2',
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            teamIds: '12324',
            enabled: false,
          },
        },
        { showErrorAlert: false }
      );

      expect(reportInteractionMock).toHaveBeenCalledWith('grafana_authentication_ssosettings_saved', {
        provider: 'github',
        enabled: false,
      });
    });
  });

  it('should validate required fields on Save', async () => {
    const { user } = setup(<ProviderConfigForm config={emptyConfig} provider={emptyConfig.provider} />);
    await user.click(screen.getByText('Save'));

    // Should show an alert for empty client ID
    expect(await screen.findAllByRole('alert')).toHaveLength(1);
  });

  it('should validate required fields on Save and enable', async () => {
    const { user } = setup(<ProviderConfigForm config={emptyConfig} provider={emptyConfig.provider} />);
    await user.click(screen.getByRole('button', { name: /Save and enable/i }));

    // Should show an alert for empty client ID
    expect(await screen.findAllByRole('alert')).toHaveLength(1);
  });

  it('should delete the current config', async () => {
    const { user } = setup(<ProviderConfigForm config={emptyConfig} provider={emptyConfig.provider} />);
    await user.click(screen.getByTitle(/More actions/i));

    await user.click(screen.getByRole('menuitem', { name: /Reset to default values/i }));

    expect(screen.getByRole('dialog', { name: /Reset/i })).toBeInTheDocument();

    await user.click(screen.getByTestId('data-testid Confirm Modal Danger Button'));

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith('/api/v1/sso-settings/github', undefined, { showSuccessAlert: false });

      expect(reportInteractionMock).toHaveBeenCalledWith('grafana_authentication_ssosettings_removed', {
        provider: 'github',
      });
    });
  });
});
