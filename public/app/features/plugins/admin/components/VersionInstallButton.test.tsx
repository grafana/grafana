import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { Provider } from 'react-redux';

import { config } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import { PluginStatus, type Version } from '../types';

import { VersionInstallButton } from './VersionInstallButton';

const mockInstall = jest.fn();
jest.mock('../state/hooks', () => ({
  ...jest.requireActual('../state/hooks'),
  useInstall: () => mockInstall,
}));

describe('VersionInstallButton', () => {
  const originalConfig = { ...config };
  afterEach(() => {
    mockInstall.mockClear();
    config.featureToggles = {
      ...originalConfig.featureToggles,
    };
    config.pluginCatalogPreinstalledPlugins = originalConfig.pluginCatalogPreinstalledPlugins;
    config.pluginCatalogPreinstalledAutoUpdate = originalConfig.pluginCatalogPreinstalledAutoUpdate;
  });
  it('should show install when no version is installed', () => {
    const version: Version = {
      version: '',
      createdAt: '',
      isCompatible: false,
      grafanaDependency: null,
    };
    renderWithStore(
      <VersionInstallButton pluginId={''} version={version} disabled={false} onConfirmInstallation={() => {}} />
    );
    expect(screen.getByText('Install')).toBeInTheDocument();
  });

  it('should show upgrade when a lower version is installed', () => {
    const version: Version = {
      version: '1.0.1',
      createdAt: '',
      isCompatible: false,
      grafanaDependency: null,
    };
    const installedVersion = '1.0.0';
    renderWithStore(
      <VersionInstallButton
        installedVersion={installedVersion}
        pluginId={''}
        version={version}
        disabled={false}
        onConfirmInstallation={() => {}}
      />
    );
    expect(screen.getByText('Upgrade')).toBeInTheDocument();
  });

  it('should show downgrade when a lower version is installed', () => {
    const version: Version = {
      version: '1.0.0',
      createdAt: '',
      isCompatible: false,
      grafanaDependency: null,
    };
    const installedVersion = '1.0.1';
    renderWithStore(
      <VersionInstallButton
        installedVersion={installedVersion}
        pluginId={''}
        version={version}
        disabled={false}
        onConfirmInstallation={() => {}}
      />
    );
    expect(screen.getByText('Downgrade')).toBeInTheDocument();
  });

  it('should ask for confirmation on downgrade', () => {
    const version: Version = {
      version: '1.0.0',
      createdAt: '',
      isCompatible: false,
      grafanaDependency: null,
    };
    const installedVersion = '1.0.1';
    renderWithStore(
      <VersionInstallButton
        installedVersion={installedVersion}
        pluginId={''}
        version={version}
        disabled={false}
        onConfirmInstallation={() => {}}
      />
    );
    expect(screen.getByText('Downgrade')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Downgrade'));
    expect(screen.getByText('Downgrade plugin version')).toBeInTheDocument();
  });

  it('should shown installed text instead of button when version is installed', () => {
    const version: Version = {
      version: '1.0.0',
      createdAt: '',
      isCompatible: false,
      grafanaDependency: null,
    };
    const installedVersion = '1.0.0';
    renderWithStore(
      <VersionInstallButton
        installedVersion={installedVersion}
        pluginId={''}
        version={version}
        disabled={false}
        onConfirmInstallation={() => {}}
      />
    );
    const el = screen.getByText('Installed');
    expect(el).toBeVisible();
  });

  it('should hide the upgrade button if preinstalled and pinned', () => {
    const version: Version = {
      version: '1.0.1',
      createdAt: '',
      isCompatible: false,
      grafanaDependency: null,
    };
    const installedVersion = '1.0.0';
    config.pluginCatalogPreinstalledAutoUpdate = true;
    config.pluginCatalogPreinstalledPlugins = [{ id: 'test', version: '1.0.0' }];
    renderWithStore(
      <VersionInstallButton
        installedVersion={installedVersion}
        pluginId={'test'}
        version={version}
        disabled={false}
        onConfirmInstallation={() => {}}
      />
    );
    expect(screen.getByText('Upgrade')).not.toBeVisible();
  });

  it('should hide the downgrade button if preinstalled and pinned', () => {
    const version: Version = {
      version: '1.0.0',
      createdAt: '',
      isCompatible: false,
      grafanaDependency: null,
    };
    const installedVersion = '1.0.1';
    config.pluginCatalogPreinstalledAutoUpdate = true;
    config.pluginCatalogPreinstalledPlugins = [{ id: 'test', version: '1.0.1' }];
    renderWithStore(
      <VersionInstallButton
        installedVersion={installedVersion}
        pluginId={'test'}
        version={version}
        disabled={false}
        onConfirmInstallation={() => {}}
      />
    );
    expect(screen.getByText('Downgrade')).not.toBeVisible();
  });

  it('should hide the downgrade button if preinstalled', () => {
    const version: Version = {
      version: '1.0.0',
      createdAt: '',
      isCompatible: false,
      grafanaDependency: null,
    };
    const installedVersion = '1.0.1';
    config.pluginCatalogPreinstalledAutoUpdate = true;
    config.pluginCatalogPreinstalledPlugins = [{ id: 'test', version: '' }];
    renderWithStore(
      <VersionInstallButton
        installedVersion={installedVersion}
        pluginId={'test'}
        version={version}
        disabled={false}
        onConfirmInstallation={() => {}}
      />
    );
    expect(screen.getByText('Downgrade')).not.toBeVisible();
  });

  it('should show the installation button if invalid semver version is provided', () => {
    const version: Version = {
      version: '1.0.a',
      createdAt: '',
      isCompatible: false,
      grafanaDependency: null,
    };
    const installedVersion = '1.0.1';
    renderWithStore(
      <VersionInstallButton
        installedVersion={installedVersion}
        pluginId={'test'}
        version={version}
        disabled={false}
        onConfirmInstallation={() => {}}
      />
    );
    expect(screen.getByText('Install')).toBeInTheDocument();
  });

  it('should clear the spinner once installedVersion catches up, even with hideInstallState set', () => {
    // Regression test: hideInstallState (used for managed plugins) must only suppress the
    // Installed/Upgrade/Downgrade labeling — it must not prevent this component from noticing
    // that a triggered install has actually completed and clearing its own local spinner state.
    const version: Version = {
      version: '1.0.1',
      createdAt: '',
      isCompatible: false,
      grafanaDependency: null,
    };
    const store = configureStore();

    const { rerender } = render(
      <Provider store={store}>
        <VersionInstallButton
          installedVersion={undefined}
          hideInstallState
          pluginId={'test'}
          version={version}
          disabled={false}
          onConfirmInstallation={() => {}}
        />
      </Provider>
    );

    fireEvent.click(screen.getByText('Install'));
    expect(screen.getByRole('button')).toBeDisabled();

    rerender(
      <Provider store={store}>
        <VersionInstallButton
          installedVersion={version.version}
          hideInstallState
          pluginId={'test'}
          version={version}
          disabled={false}
          onConfirmInstallation={() => {}}
        />
      </Provider>
    );

    expect(screen.getByRole('button')).not.toBeDisabled();
    expect(screen.getByText('Install')).toBeInTheDocument();
  });

  it('should dispatch an update (not a fresh install) for a managed plugin upgrade', () => {
    // Regression test: hideInstallState only neutralizes the displayed label to "Install" — the
    // dispatched operation must still be an UPDATE so hasUpdate is cleared and the plugin info
    // cache is invalidated, exactly as it would be for a non-managed upgrade.
    const version: Version = {
      version: '2.0.0',
      createdAt: '',
      isCompatible: true,
      grafanaDependency: null,
    };
    renderWithStore(
      <VersionInstallButton
        installedVersion="1.0.0"
        hideInstallState
        pluginId={'test'}
        version={version}
        disabled={false}
        onConfirmInstallation={() => {}}
      />
    );

    // Display is a neutral "Install" (no Upgrade label) for managed plugins...
    const button = screen.getByText('Install');
    fireEvent.click(button);

    // ...but the underlying operation is still an update.
    expect(mockInstall).toHaveBeenCalledWith('test', '2.0.0', PluginStatus.UPDATE);
  });

  it('should show the installation button if invalid semver installed version is provided', () => {
    const version: Version = {
      version: '1.0.0',
      createdAt: '',
      isCompatible: false,
      grafanaDependency: null,
    };
    const installedVersion = '1.0.a';
    renderWithStore(
      <VersionInstallButton
        installedVersion={installedVersion}
        pluginId={'test'}
        version={version}
        disabled={false}
        onConfirmInstallation={() => {}}
      />
    );
    expect(screen.getByText('Install')).toBeInTheDocument();
  });
});

function renderWithStore(component: JSX.Element) {
  const store = configureStore();

  return render(<Provider store={store}>{component}</Provider>);
}
