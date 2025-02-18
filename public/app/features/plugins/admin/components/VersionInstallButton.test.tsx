import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';

import { config } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import { Version } from '../types';

import { VersionInstallButton } from './VersionInstallButton';

describe('VersionInstallButton', () => {
  const originalConfig = { ...config };
  afterEach(() => {
    config.featureToggles = {
      ...originalConfig.featureToggles,
    };
    config.pluginCatalogPreinstalledPlugins = originalConfig.pluginCatalogPreinstalledPlugins;
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
    config.featureToggles.preinstallAutoUpdate = true;
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
    config.featureToggles.preinstallAutoUpdate = true;
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
    config.featureToggles.preinstallAutoUpdate = true;
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
});

function renderWithStore(component: JSX.Element) {
  const store = configureStore();

  return render(<Provider store={store}>{component}</Provider>);
}
