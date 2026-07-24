import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { useAssistant } from '@grafana/assistant';
import { PluginSignatureStatus, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import { getPluginsStateMock } from '../../mocks/mockHelpers';
import { type CatalogPlugin, PluginStatus } from '../../types';

import { InstallControlsButton } from './InstallControlsButton';

jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(),
  createAssistantContextItem: jest.fn(<T extends object>(type: string, data: T) => ({
    type,
    ...data,
  })),
}));

const mockUseAssistant = jest.mocked(useAssistant);

const plugin: CatalogPlugin = {
  description: 'The test plugin',
  downloads: 5,
  id: 'test-plugin',
  info: {
    logos: { small: '', large: '' },
    keywords: ['test', 'plugin'],
  },
  name: 'Testing Plugin',
  orgName: 'Test',
  popularity: 0,
  signature: PluginSignatureStatus.valid,
  publishedAt: '2020-09-01',
  updatedAt: '2021-06-28',
  hasUpdate: false,
  isInstalled: false,
  isCore: false,
  isDev: false,
  isEnterprise: false,
  isDisabled: false,
  isDeprecated: false,
  isPublished: true,
  isPreinstalled: { found: false, withVersion: false },
  managed: {
    enabled: false,
    strategy: undefined,
  },
};

describe('InstallControlsButton', () => {
  beforeEach(() => {
    // Default: assistant unavailable, so the plain install button renders.
    mockUseAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: false,
      openAssistant: undefined,
      closeAssistant: undefined,
      toggleAssistant: undefined,
    });
  });

  it('should not allow install if angular is detected', () => {
    render(
      <TestProvider>
        <InstallControlsButton plugin={{ ...plugin, angularDetected: true }} pluginStatus={PluginStatus.INSTALL} />
      </TestProvider>
    );
    const el = screen.getByRole('button');
    expect(el).toHaveTextContent(/install/i);
    expect(el).toBeVisible();
    expect(el).toBeDisabled();
  });

  it("should allow to uninstall a plugin even if it's unpublished", () => {
    render(
      <TestProvider>
        <InstallControlsButton plugin={{ ...plugin, isPublished: false }} pluginStatus={PluginStatus.UNINSTALL} />
      </TestProvider>
    );
    const el = screen.getByRole('button');
    expect(el).toHaveTextContent(/uninstall/i);
    expect(el).toBeVisible();
  });

  it('should not render install or upgrade buttons if the plugin is unpublished', () => {
    render(
      <TestProvider>
        <InstallControlsButton plugin={{ ...plugin, isPublished: false }} pluginStatus={PluginStatus.INSTALL} />
      </TestProvider>
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  describe('update button on prem', () => {
    const store = configureStore({
      plugins: getPluginsStateMock([]),
    });

    it('should be disabled when is Installing', () => {
      store.dispatch({ type: 'plugins/install/pending' });
      render(
        <TestProvider store={store}>
          <InstallControlsButton plugin={{ ...plugin }} pluginStatus={PluginStatus.UPDATE} />
        </TestProvider>
      );
      const button = screen.getByText('Updating').closest('button');
      expect(button).toBeDisabled();
    });

    it('should be enabled when it is not Installing', () => {
      store.dispatch({ type: 'plugins/install/fulfilled', payload: { id: '', changes: {} } });
      render(
        <TestProvider store={store}>
          <InstallControlsButton plugin={{ ...plugin }} pluginStatus={PluginStatus.UPDATE} />
        </TestProvider>
      );
      const button = screen.getByText('Update').closest('button');
      expect(button).toBeEnabled();
    });
  });

  describe('update button on managed instance', () => {
    const oldPluginAdminExternalManageEnabled = config.pluginAdminExternalManageEnabled;

    beforeAll(() => {
      config.pluginAdminExternalManageEnabled = true;
    });

    afterAll(() => {
      config.pluginAdminExternalManageEnabled = oldPluginAdminExternalManageEnabled;
    });

    const store = configureStore({
      plugins: getPluginsStateMock([]),
    });

    it('should be disabled when isInstalling=false but isUpdatingFromInstance=true', () => {
      store.dispatch({ type: 'plugins/install/fulfilled', payload: { id: '', changes: {} } });
      render(
        <TestProvider store={store}>
          <InstallControlsButton
            plugin={{ ...plugin, isUpdatingFromInstance: true }}
            pluginStatus={PluginStatus.UPDATE}
          />
        </TestProvider>
      );
      const button = screen.getByText('Update').closest('button');
      expect(button).toBeDisabled();
    });

    it('should be enabled when isInstalling=false and isUpdatingFromInstance=false', () => {
      store.dispatch({ type: 'plugins/install/fulfilled', payload: { id: '', changes: {} } });
      render(
        <TestProvider store={store}>
          <InstallControlsButton
            plugin={{ ...plugin, isUpdatingFromInstance: false }}
            pluginStatus={PluginStatus.UPDATE}
          />
        </TestProvider>
      );
      const button = screen.getByText('Update').closest('button');
      expect(button).toBeEnabled();
    });
  });

  describe('uninstall button on prem', () => {
    const store = configureStore({
      plugins: getPluginsStateMock([]),
    });

    it('should be disabled when is Installing', () => {
      store.dispatch({ type: 'plugins/uninstall/pending' });
      render(
        <TestProvider store={store}>
          <InstallControlsButton plugin={{ ...plugin }} pluginStatus={PluginStatus.UNINSTALL} />
        </TestProvider>
      );
      const button = screen.getByText('Uninstalling').closest('button');
      expect(button).toBeDisabled();
    });

    it('should be enabled when it is not Installing', () => {
      store.dispatch({ type: 'plugins/uninstall/fulfilled', payload: { id: '', changes: {} } });
      render(
        <TestProvider store={store}>
          <InstallControlsButton plugin={{ ...plugin }} pluginStatus={PluginStatus.UNINSTALL} />
        </TestProvider>
      );
      const button = screen.getByText('Uninstall').closest('button');
      expect(button).toBeEnabled();
    });
  });

  describe('uninstall button on managed instance', () => {
    const oldPluginAdminExternalManageEnabled = config.pluginAdminExternalManageEnabled;

    beforeAll(() => {
      config.pluginAdminExternalManageEnabled = true;
    });

    afterAll(() => {
      config.pluginAdminExternalManageEnabled = oldPluginAdminExternalManageEnabled;
    });

    const store = configureStore({
      plugins: getPluginsStateMock([]),
    });

    it('should be disabled when isInstalling=false but isUninstallingFromInstance=true', () => {
      store.dispatch({ type: 'plugins/uninstall/fulfilled', payload: { id: '', changes: {} } });
      render(
        <TestProvider store={store}>
          <InstallControlsButton
            plugin={{ ...plugin, isUninstallingFromInstance: true }}
            pluginStatus={PluginStatus.UNINSTALL}
          />
        </TestProvider>
      );
      const button = screen.getByText('Uninstall').closest('button');
      expect(button).toBeDisabled();
    });

    it('should be disabled when isInstalling=false but isUpdatingFromInstance=true', () => {
      store.dispatch({ type: 'plugins/uninstall/fulfilled', payload: { id: '', changes: {} } });
      render(
        <TestProvider store={store}>
          <InstallControlsButton
            plugin={{ ...plugin, isUpdatingFromInstance: true }}
            pluginStatus={PluginStatus.UNINSTALL}
          />
        </TestProvider>
      );
      const button = screen.getByText('Uninstall').closest('button');
      expect(button).toBeDisabled();
    });

    it('should be disabled when isInstalling=false but isFullyInstalled=false', () => {
      store.dispatch({ type: 'plugins/uninstall/fulfilled', payload: { id: '', changes: {} } });
      render(
        <TestProvider store={store}>
          <InstallControlsButton
            plugin={{ ...plugin, isFullyInstalled: false }}
            pluginStatus={PluginStatus.UNINSTALL}
          />
        </TestProvider>
      );
      const button = screen.getByText('Uninstall').closest('button');
      expect(button).toBeDisabled();
    });

    it('should be enabled when isInstalling=false and isUninstallingFromInstance=false', () => {
      store.dispatch({ type: 'plugins/uninstall/fulfilled', payload: { id: '', changes: {} } });
      render(
        <TestProvider store={store}>
          <InstallControlsButton
            plugin={{ ...plugin, isUninstallingFromInstance: false, isFullyInstalled: true }}
            pluginStatus={PluginStatus.UNINSTALL}
          />
        </TestProvider>
      );
      const button = screen.getByText('Uninstall').closest('button');
      expect(button).toBeEnabled();
    });
  });

  describe('marketplace plugin', () => {
    it('should render a link to grafana.com installation tab instead of install button when not entitled', () => {
      render(
        <TestProvider>
          <InstallControlsButton
            plugin={{ ...plugin, distributionType: 'marketplace' }}
            pluginStatus={PluginStatus.INSTALL}
            entitlement={{ entitled: false, isLoading: false }}
          />
        </TestProvider>
      );
      const link = screen.getByRole('link');
      expect(link).toHaveTextContent(/contact us/i);
      expect(link).toHaveAttribute('href', expect.stringContaining('/plugins/test-plugin?tab=installation'));
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('aria-disabled', 'false');
    });

    it('should render a disabled contact us link with a spinner when entitlement is loading', () => {
      render(
        <TestProvider>
          <InstallControlsButton
            plugin={{ ...plugin, distributionType: 'marketplace' }}
            pluginStatus={PluginStatus.INSTALL}
            entitlement={{ entitled: false, isLoading: true }}
          />
        </TestProvider>
      );
      const link = screen.getByRole('link');
      expect(link).toHaveTextContent(/contact us/i);
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link.querySelector('svg')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should render the normal install button when the org is entitled', () => {
      render(
        <TestProvider>
          <InstallControlsButton
            plugin={{ ...plugin, distributionType: 'marketplace' }}
            pluginStatus={PluginStatus.INSTALL}
            entitlement={{ entitled: true, isLoading: false }}
          />
        </TestProvider>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveTextContent(/install/i);
      expect(button).not.toBeDisabled();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('should not render marketplace link when distributionType is not set', () => {
      render(
        <TestProvider>
          <InstallControlsButton plugin={{ ...plugin }} pluginStatus={PluginStatus.INSTALL} />
        </TestProvider>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveTextContent(/install/i);
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('should not render marketplace link for non-marketplace distribution types', () => {
      render(
        <TestProvider>
          <InstallControlsButton
            plugin={{ ...plugin, distributionType: 'catalog' }}
            pluginStatus={PluginStatus.INSTALL}
          />
        </TestProvider>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveTextContent(/install/i);
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('update button', () => {
    it('should be hidden when plugin is managed', () => {
      render(
        <TestProvider>
          <InstallControlsButton
            plugin={{ ...plugin, managed: { enabled: true } }}
            pluginStatus={PluginStatus.UPDATE}
          />
        </TestProvider>
      );
      expect(screen.queryByText('Update')).not.toBeInTheDocument();
    });

    it('should be hidden when plugin is preinstalled with a specific version', () => {
      render(
        <TestProvider>
          <InstallControlsButton
            plugin={{ ...plugin, isPreinstalled: { found: true, withVersion: true } }}
            pluginStatus={PluginStatus.UPDATE}
          />
        </TestProvider>
      );
      expect(screen.queryByText('Update')).not.toBeInTheDocument();
    });
  });

  describe('install button with assistant', () => {
    const store = configureStore({
      plugins: getPluginsStateMock([]),
    });
    const openAssistant = jest.fn();

    beforeEach(() => {
      store.dispatch({ type: 'plugins/install/fulfilled', payload: { id: '', changes: {} } });
      mockUseAssistant.mockReturnValue({
        isLoading: false,
        isAvailable: true,
        openAssistant,
        closeAssistant: jest.fn(),
        toggleAssistant: jest.fn(),
      });
    });

    it('renders assistant and manual install options in a dropdown when the assistant is available', async () => {
      const user = userEvent.setup();
      render(
        <TestProvider store={store}>
          <InstallControlsButton
            plugin={{ ...plugin, type: PluginType.datasource }}
            pluginStatus={PluginStatus.INSTALL}
          />
        </TestProvider>
      );

      await user.click(screen.getByRole('button', { name: /install/i }));

      expect(await screen.findByText('Install with assistant')).toBeInTheDocument();
      expect(screen.getByText('Install manually')).toBeInTheDocument();
    });

    it('opens the assistant when "Install with assistant" is selected', async () => {
      const user = userEvent.setup();
      render(
        <TestProvider store={store}>
          <InstallControlsButton
            plugin={{ ...plugin, type: PluginType.datasource }}
            pluginStatus={PluginStatus.INSTALL}
          />
        </TestProvider>
      );

      await user.click(screen.getByRole('button', { name: /install/i }));
      await user.click(await screen.findByText('Install with assistant'));

      expect(openAssistant).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: `grafana/plugin-page/${plugin.id}/install-plugin`,
          mode: 'assistant',
          autoSend: true,
        })
      );
    });

    it('renders a plain install button (no dropdown) when the assistant is not available', () => {
      mockUseAssistant.mockReturnValue({
        isLoading: false,
        isAvailable: false,
        openAssistant: undefined,
        closeAssistant: undefined,
        toggleAssistant: undefined,
      });

      render(
        <TestProvider store={store}>
          <InstallControlsButton
            plugin={{ ...plugin, type: PluginType.datasource }}
            pluginStatus={PluginStatus.INSTALL}
          />
        </TestProvider>
      );

      expect(screen.getByRole('button', { name: /install/i })).toBeInTheDocument();
      expect(screen.queryByText('Install with assistant')).not.toBeInTheDocument();
    });
  });
});
