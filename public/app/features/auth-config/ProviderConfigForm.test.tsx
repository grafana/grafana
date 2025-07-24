import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JSX } from 'react';

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
    ...jest.requireActual('@grafana/runtime').config,
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
    teamIds: '[]',
    allowedOrganizations: '[]',
    allowedDomains: '[]',
    allowedGroups: '[]',
    scopes: '[]',
    orgMapping: '[]',
  },
};

jest.mock('app/core/core', () => {
  return {
    contextSrv: {
      isGrafanaAdmin: true,
    },
  };
});

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

  it('renders all general settings fields correctly', async () => {
    setup(<ProviderConfigForm config={testConfig} provider={testConfig.provider} />);
    expect(screen.getByRole('textbox', { name: /Client ID/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Client secret/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Scopes/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Allow Sign Up/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Auto login/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Sign out redirect URL/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Discard/i })).toBeInTheDocument();
  });

  it('renders all user mapping fields correctly', async () => {
    const { user } = setup(<ProviderConfigForm config={testConfig} provider={testConfig.provider} />);
    await user.click(screen.getByText('User mapping'));
    expect(screen.getByRole('textbox', { name: /Role attribute path/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Role attribute strict mode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Skip organization role sync/i)).toBeInTheDocument();
  });

  it('renders all extra security fields correctly', async () => {
    const { user } = setup(<ProviderConfigForm config={testConfig} provider={testConfig.provider} />);
    await user.click(screen.getByText('Extra security measures'));
    expect(screen.getByRole('combobox', { name: /Allowed organizations/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Allowed domains/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Team Ids/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Use PKCE/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Use refresh token/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/TLS skip verify/i)).toBeInTheDocument();
  });

  it('should save and enable on form submit', async () => {
    const { user } = setup(<ProviderConfigForm config={emptyConfig} provider={emptyConfig.provider} />);

    await user.type(screen.getByRole('textbox', { name: /Client ID/i }), 'test-client-id');
    await user.type(screen.getByLabelText(/Client secret/i), 'test-client-secret');
    // Type a scope and press enter to select it
    await user.type(screen.getByRole('combobox', { name: /Scopes/i }), 'user:email{enter}');
    await user.click(screen.getByLabelText(/Auto login/i));

    await user.click(screen.getByText('User mapping'));
    await user.type(screen.getByRole('textbox', { name: /Role attribute path/i }), 'new-attribute-path');
    await user.click(screen.getByLabelText(/Role attribute strict mode/i));
    await user.type(screen.getByRole('combobox', { name: /Organization mapping/i }), 'Group A:1:Editor{enter}');
    await user.type(screen.getByRole('combobox', { name: /Organization mapping/i }), 'Group B:2:Admin{enter}');

    await user.click(screen.getByText('Extra security measures'));
    await user.type(screen.getByRole('combobox', { name: /Allowed domains/i }), 'grafana.com{enter}');
    await user.click(screen.getByRole('checkbox', { name: /Use PKCE/i }));

    await user.click(screen.getByRole('button', { name: /Save and enable/i }));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        '/api/v1/sso-settings/github',
        {
          id: '300f9b7c-0488-40db-9763-a22ce8bf6b3e',
          provider: 'github',
          settings: {
            allowAssignGrafanaAdmin: false,
            allowSignUp: false,
            allowedDomains: '["grafana.com"]',
            allowedOrganizations: '[]',
            autoLogin: true,
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            enabled: true,
            loginPrompt: '',
            name: 'GitHub',
            orgMapping: '["Group A:1:Editor","Group B:2:Admin"]',
            roleAttributePath: 'new-attribute-path',
            roleAttributeStrict: true,
            scopes: '["user:email"]',
            signoutRedirectUrl: '',
            skipOrgRoleSync: false,
            teamIds: '[]',
            tlsClientCa: '',
            tlsClientCert: '',
            tlsClientKey: '',
            tlsSkipVerifyInsecure: false,
            usePkce: true,
            useRefreshToken: false,
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
    // Type a scope and press enter to select it
    await user.type(screen.getByRole('combobox', { name: /Scopes/i }), 'user:email{enter}');
    await user.click(screen.getByLabelText(/Auto login/i));
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        '/api/v1/sso-settings/github',
        {
          id: '300f9b7c-0488-40db-9763-a22ce8bf6b3e',
          provider: 'github',
          settings: {
            allowAssignGrafanaAdmin: false,
            allowSignUp: false,
            allowedDomains: '[]',
            allowedOrganizations: '[]',
            autoLogin: true,
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            enabled: false,
            loginPrompt: '',
            name: 'GitHub',
            roleAttributePath: '',
            roleAttributeStrict: false,
            scopes: '["user:email"]',
            signoutRedirectUrl: '',
            skipOrgRoleSync: false,
            teamIds: '[]',
            tlsClientCa: '',
            tlsClientCert: '',
            tlsClientKey: '',
            usePkce: false,
            useRefreshToken: false,
            orgMapping: '[]',
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
