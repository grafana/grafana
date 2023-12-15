import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { JSX } from 'react';

import { ProviderConfig } from './ProviderConfigPage';

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
}));

// Mock the FormPrompt component as it requires Router setup to work
jest.mock('app/core/components/FormPrompt/FormPrompt', () => ({
  FormPrompt: () => <></>,
}));

const testSettings = {
  provider: 'github',
  settings: {
    name: 'GitHub',
    type: 'OAuth',
    clientId: '12345',
    clientSecret: 'abcde',
    enabled: true,
    teamIds: '',
    allowedOrganizations: '',
  },
};

const emptySettings = { ...testSettings, settings: { ...testSettings.settings, clientId: '', clientSecret: '' } };

function setup(jsx: JSX.Element) {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
}

describe('ProviderConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all fields correctly', async () => {
    setup(<ProviderConfig config={testSettings} provider={testSettings.provider} />);
    expect(screen.getByRole('checkbox', { name: /Enabled/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Client ID/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Team IDs/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Allowed organizations/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Discard/i })).toBeInTheDocument();
  });

  it('should save correct data on form submit', async () => {
    const { user } = setup(<ProviderConfig config={emptySettings} provider={emptySettings.provider} />);
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
        ...testSettings,
        settings: {
          ...testSettings.settings,
          allowedOrganizations: 'test-org1,test-org2',
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          teamIds: '12324',
          enabled: false,
        },
      });
    });
  });

  it('should validate required fields', async () => {
    const { user } = setup(<ProviderConfig config={emptySettings} provider={emptySettings.provider} />);
    await user.click(screen.getByRole('button', { name: /Save/i }));

    // Should show 2 alerts for 2 empty fields
    expect(await screen.findAllByRole('alert')).toHaveLength(2);
  });
});
