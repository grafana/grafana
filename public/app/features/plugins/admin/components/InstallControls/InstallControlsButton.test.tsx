import { render, screen } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { PluginSignatureStatus } from '@grafana/data';
import { config } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import { getPluginsStateMock } from '../../__mocks__';
import { CatalogPlugin, PluginStatus } from '../../types';

import { InstallControlsButton } from './InstallControlsButton';

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
  isManaged: false,
  isPreinstalled: { found: false, withVersion: false },
};

function setup(opts: { angularSupportEnabled: boolean; angularDetected: boolean }) {
  config.angularSupportEnabled = opts.angularSupportEnabled;
  render(
    <TestProvider>
      <InstallControlsButton
        plugin={{ ...plugin, angularDetected: opts.angularDetected }}
        pluginStatus={PluginStatus.INSTALL}
      />
    </TestProvider>
  );
}

describe('InstallControlsButton', () => {
  let oldAngularSupportEnabled = config.angularSupportEnabled;
  afterAll(() => {
    config.angularSupportEnabled = oldAngularSupportEnabled;
  });

  describe.each([{ angularSupportEnabled: true }, { angularSupportEnabled: false }])(
    'angular support is $angularSupportEnabled',
    ({ angularSupportEnabled }) => {
      it.each([
        { angularDetected: true, expectEnabled: angularSupportEnabled },
        { angularDetected: false, expectEnabled: true },
      ])('angular detected is $angularDetected', ({ angularDetected, expectEnabled }) => {
        setup({ angularSupportEnabled, angularDetected });

        const el = screen.getByRole('button');
        expect(el).toHaveTextContent(/install/i);
        expect(el).toBeVisible();
        if (expectEnabled) {
          expect(el).toBeEnabled();
        } else {
          expect(el).toBeDisabled();
        }
      });
    }
  );

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

  describe('update button', () => {
    it('should be hidden when plugin is managed', () => {
      render(
        <TestProvider>
          <InstallControlsButton plugin={{ ...plugin, isManaged: true }} pluginStatus={PluginStatus.UPDATE} />
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
});
