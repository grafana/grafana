import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { JSX } from 'react';

import { ProviderConfigForm } from './ProviderConfigForm';
import { SSOProvider } from './types';
import { emptySettings } from './utils/data';

const putMock = jest.fn(() => Promise.resolve({}));
jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({
    put: putMock,
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
}));

// Mock the FormPrompt component as it requires Router setup to work
jest.mock('app/core/components/FormPrompt/FormPrompt', () => ({
  FormPrompt: () => <></>,
}));

const testConfig: SSOProvider = {
  id: '300f9b7c-0488-40db-9763-a22ce8bf6b3e',
  provider: 'github',
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
  settings: { ...testConfig.settings, clientId: '', clientSecret: '' },
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
    expect(screen.getByRole('checkbox', { name: /Enabled/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Client ID/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Team IDs/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Allowed organizations/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Discard/i })).toBeInTheDocument();
  });

  it('should save correct data on form submit', async () => {
    const { user } = setup(<ProviderConfigForm config={emptyConfig} provider={emptyConfig.provider} />);
    await user.type(screen.getByRole('textbox', { name: /Client ID/i }), 'test-client-id');
    await user.type(screen.getByLabelText(/Client secret/i), 'test-client-secret');
    // Type a team name and press enter to select it
    await user.type(screen.getByRole('combobox', { name: /Team IDs/i }), '12324{enter}');
    // Add two orgs
    await user.type(screen.getByRole('combobox', { name: /Allowed organizations/i }), 'test-org1{enter}');
    await user.type(screen.getByRole('combobox', { name: /Allowed organizations/i }), 'test-org2{enter}');
    await user.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith('/api/v1/sso-settings/github', {
        ...testConfig,
        settings: {
          ...testConfig.settings,
          allowedOrganizations: 'test-org1,test-org2',
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          teamIds: '12324',
          enabled: true,
          allowedDomains: '',
          allowedGroups: '',
          scopes: '',
        },
      });
    });
  });

  it('should validate required fields', async () => {
    const { user } = setup(<ProviderConfigForm config={emptyConfig} provider={emptyConfig.provider} />);
    await user.click(screen.getByRole('button', { name: /Save/i }));

    // Should show an alert for empty client ID
    expect(await screen.findAllByRole('alert')).toHaveLength(1);
  });
});
