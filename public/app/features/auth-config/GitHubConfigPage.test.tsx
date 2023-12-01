import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { JSX } from 'react';

import { GitHubConfig } from './GitHubConfigPage';

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: jest.fn(),
  config: {
    panels: {
      test: {
        id: 'test',
        name: 'test',
      },
    },
    featureToggles: {
      dockedMegaMenu: true,
    },
    theme2: { breakpoints: { values: { sm: 0 } } },
  },
  getAppEvents: () => ({
    publish: jest.fn(),
  }),
  isFetchError: () => true,
}));

// Mock FormPrompt component as it requires Router setup to work
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

describe('GitHubConfig', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('renders all fields correctly', async () => {
    setup(<GitHubConfig settings={testSettings} />);
    expect(screen.getByRole('checkbox', { name: /Enabled/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Client ID/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Team IDs/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Allowed organizations/i })).toBeInTheDocument();
  });

  it('correct data is saved on form submit', async () => {
    const { getBackendSrv } = require('@grafana/runtime');
    const backendSrvMock = {
      post: jest.fn(() => Promise.resolve({})),
    };
    getBackendSrv.mockReturnValue(backendSrvMock);

    const { user } = setup(<GitHubConfig settings={emptySettings} />);
    await user.type(screen.getByRole('textbox', { name: /Client ID/i }), 'test-client-id');
    await user.type(screen.getByRole('textbox', { name: /Client secret/i }), 'test-client-secret');
    await user.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(backendSrvMock.post).toHaveBeenCalledWith('/api/v1/sso-settings', {
        provider: 'github',
        settings: {
          allowedOrganizations: '',
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          enabled: true,
          name: 'GitHub',
          teamIds: '',
          type: 'OAuth',
        },
      });
    });
  });

  it('required fields validated', async () => {
    const { user } = setup(<GitHubConfig settings={emptySettings} />);
    await user.click(screen.getByRole('button', { name: /Save/i }));

    expect(await screen.findAllByRole('alert')).toHaveLength(2);
  });
});
