import { OpenFeatureTestProvider } from '@openfeature/react-sdk';
import { render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { Provider } from 'react-redux';

import { config } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import { getCatalogPluginMock } from '../mocks/mockHelpers';
import { PluginUpdateStrategy } from '../types';

import { VersionList } from './VersionList';

describe('VersionList', () => {
  it('should only show installs when no version is installed', () => {
    const versions = [
      {
        version: '1.0.0',
        createdAt: '',
        isCompatible: false,
        grafanaDependency: null,
      },
      {
        version: '1.0.1',
        createdAt: '',
        isCompatible: false,
        grafanaDependency: null,
      },
    ];

    const plugin = getCatalogPluginMock({
      details: {
        grafanaDependency: '>=8.0.0',
        pluginDependencies: [],
        links: [{ name: 'GitHub', url: 'https://example.com' }],
        versions,
      },
      managed: { enabled: false, strategy: PluginUpdateStrategy.MajorAligned },
    });

    renderWithStore(<VersionList plugin={plugin} />);
    const installElements = screen.getAllByText('Install');
    expect(installElements).toHaveLength(versions.length);
  });

  it('should downgrades and upgrades when one intermediate version is installed', () => {
    const versions = [
      {
        version: '1.0.0',
        createdAt: '',
        isCompatible: false,
        grafanaDependency: null,
      },
      {
        version: '1.0.1',
        createdAt: '',
        isCompatible: false,
        grafanaDependency: null,
      },
      {
        version: '1.0.2',
        createdAt: '',
        isCompatible: false,
        grafanaDependency: null,
      },
    ];

    const installedVersionIndex = 1;

    const plugin = getCatalogPluginMock({
      details: {
        grafanaDependency: '>=8.0.0',
        pluginDependencies: [],
        links: [{ name: 'GitHub', url: 'https://example.com' }],
        versions,
      },
      managed: { enabled: false, strategy: PluginUpdateStrategy.MajorAligned },
      installedVersion: versions[installedVersionIndex].version,
    });

    renderWithStore(<VersionList plugin={plugin} />);

    expect(screen.getAllByText('Installed')).toHaveLength(1);
    expect(screen.getAllByText('Downgrade')).toHaveLength(1);
    expect(screen.getAllByText('Upgrade')).toHaveLength(1);
  });

  it('should show deprecated badge for installed version that is not in the versions list', () => {
    const versions = [
      {
        version: '3.0.0',
        createdAt: '2024-01-01',
        isCompatible: true,
        grafanaDependency: '>=10.0.0',
      },
      {
        version: '2.5.0',
        createdAt: '2023-08-01',
        isCompatible: true,
        grafanaDependency: '>=9.0.0',
        status: 'deprecated', // This version is deprecated
      },
      {
        version: '2.0.0',
        createdAt: '2023-06-01',
        isCompatible: true,
        grafanaDependency: '>=9.0.0',
      },
      {
        version: '1.0.0',
        createdAt: '2023-01-01',
        isCompatible: true,
        grafanaDependency: '>=8.0.0',
      },
    ];

    // User has 2.5.0 installed, which is deprecated
    const installedVersion = '2.5.0';

    const plugin = getCatalogPluginMock({
      details: {
        grafanaDependency: '>=8.0.0',
        pluginDependencies: [],
        links: [{ name: 'GitHub', url: 'https://example.com' }],
        versions,
      },
      managed: { enabled: false, strategy: PluginUpdateStrategy.MajorAligned },
      installedVersion,
    });

    renderWithStore(<VersionList plugin={plugin} />);

    expect(screen.getByText('Deprecated')).toBeInTheDocument();
    expect(screen.getByText(/2\.5\.0.*\(installed version\)/)).toBeInTheDocument();

    const versionCells = screen.getAllByRole('cell', { name: /\d+\.\d+\.\d+/ });
    expect(versionCells.length).toBeGreaterThanOrEqual(4);

    const downgrades = screen.getAllByText('Downgrade');
    expect(downgrades.length).toBe(2);
  });

  it('should sort deprecated installed version correctly with semantic versioning', () => {
    const versions = [
      {
        version: '3.0.0',
        createdAt: '2024-01-01',
        isCompatible: true,
        grafanaDependency: '>=10.0.0',
      },
      {
        version: '2.0.0',
        createdAt: '2023-06-01',
        isCompatible: true,
        grafanaDependency: '>=9.0.0',
        status: 'deprecated', // This version is deprecated
      },
      {
        version: '1.0.0',
        createdAt: '2023-01-01',
        isCompatible: true,
        grafanaDependency: '>=8.0.0',
      },
    ];

    // User has 2.0.0 installed, which is deprecated
    const installedVersion = '2.0.0';

    const plugin = getCatalogPluginMock({
      details: {
        grafanaDependency: '>=8.0.0',
        pluginDependencies: [],
        links: [{ name: 'GitHub', url: 'https://example.com' }],
        versions,
      },
      managed: { enabled: false, strategy: PluginUpdateStrategy.MajorAligned },
      installedVersion,
    });

    renderWithStore(<VersionList plugin={plugin} />);

    const rows = screen.getAllByRole('row');
    const versionTexts = rows.slice(1).map((row) => {
      const versionCell = row.querySelector('td:first-child');
      return versionCell?.textContent || '';
    });

    // Versions should be sorted: 3.0.0, 2.0.0 (deprecated), 1.0.0
    expect(versionTexts[0]).toContain('3.0.0');
    expect(versionTexts[1]).toContain('2.0.0');
    expect(versionTexts[1]).toContain('(installed version)');
    expect(versionTexts[2]).toContain('1.0.0');
  });

  it('should enable only the install button for the major aligned compatible version, when it is major aligned managed plugin and there is a version installed', () => {
    const versions = [
      ...generateVersionsForMajor('1', 3),
      ...generateVersionsForMajor('2', 3),
      ...generateVersionsForMajor('3', 3),
    ];

    const installedVersion = '2.0.0';

    const managedPluginsV2Original = config.featureToggles.managedPluginsV2;
    config.featureToggles.managedPluginsV2 = true;

    const pluginAdminExternalManageEnabledOriginal = config.pluginAdminExternalManageEnabled;
    config.pluginAdminExternalManageEnabled = true;

    const plugin = getCatalogPluginMock({
      details: {
        grafanaDependency: '>=8.0.0',
        pluginDependencies: [],
        links: [{ name: 'GitHub', url: 'https://example.com' }],
        versions,
      },
      managed: { enabled: false, strategy: PluginUpdateStrategy.MajorAligned },
      installedVersion,
    });

    renderWithStore(<VersionList plugin={plugin} />, { managedPluginsV2: true });
    const buttons = screen.getAllByRole('button');
    const enabledButtons = buttons.filter((btn) => !(btn as HTMLButtonElement).disabled);
    expect(enabledButtons).toHaveLength(2);

    config.featureToggles.managedPluginsV2 = managedPluginsV2Original;
    config.pluginAdminExternalManageEnabled = pluginAdminExternalManageEnabledOriginal;
  });

  it('should enable only the install button for the major aligned compatible version, when it is major aligned managed plugin and there is no version installed', () => {
    const versions = [
      ...generateVersionsForMajor('1', 3),
      ...generateVersionsForMajor('2', 3),
      ...generateVersionsForMajor('3', 3),
    ];

    const managedPluginsV2Original = config.featureToggles.managedPluginsV2;
    config.featureToggles.managedPluginsV2 = true;

    const pluginAdminExternalManageEnabledOriginal = config.pluginAdminExternalManageEnabled;
    config.pluginAdminExternalManageEnabled = true;

    const plugin = getCatalogPluginMock({
      details: {
        grafanaDependency: '>=8.0.0',
        pluginDependencies: [],
        links: [{ name: 'GitHub', url: 'https://example.com' }],
        versions,
      },
      managed: { enabled: false, strategy: PluginUpdateStrategy.MajorAligned },
    });

    renderWithStore(<VersionList plugin={plugin} />, { managedPluginsV2: true });
    const buttons = screen.getAllByRole('button');
    const enabledButtons = buttons.filter((btn) => !(btn as HTMLButtonElement).disabled);
    expect(enabledButtons).toHaveLength(1);

    config.featureToggles.managedPluginsV2 = managedPluginsV2Original;
    config.pluginAdminExternalManageEnabled = pluginAdminExternalManageEnabledOriginal;
  });

  it('should disable all versions when plugin is managed and update strategy is "assigned"', () => {
    const versions = [
      ...generateVersionsForMajor('1', 3),
      ...generateVersionsForMajor('2', 3),
      ...generateVersionsForMajor('3', 3),
    ];

    const installedVersion = '2.0.0';

    const managedPluginsV2Original = config.featureToggles.managedPluginsV2;
    config.featureToggles.managedPluginsV2 = true;

    const pluginAdminExternalManageEnabledOriginal = config.pluginAdminExternalManageEnabled;
    config.pluginAdminExternalManageEnabled = true;

    const plugin = getCatalogPluginMock({
      details: {
        grafanaDependency: '>=8.0.0',
        pluginDependencies: [],
        links: [{ name: 'GitHub', url: 'https://example.com' }],
        versions,
      },
      managed: { enabled: false, strategy: PluginUpdateStrategy.Assigned },
      installedVersion,
    });

    renderWithStore(<VersionList plugin={plugin} />, { managedPluginsV2: true });
    const buttons = screen.getAllByRole('button');
    const disabledButtons = buttons.filter((btn) => (btn as HTMLButtonElement).disabled);
    expect(disabledButtons).toHaveLength(versions.length - 1);

    config.featureToggles.managedPluginsV2 = managedPluginsV2Original;
    config.pluginAdminExternalManageEnabled = pluginAdminExternalManageEnabledOriginal;
  });
});

function renderWithStore(component: JSX.Element, flags: { [key: string]: boolean } = {}) {
  const store = configureStore();

  return render(
    <Provider store={store}>
      <OpenFeatureTestProvider flagValueMap={flags}>{component}</OpenFeatureTestProvider>
    </Provider>
  );
}

function generateVersionsForMajor(major: string, numberOfVersions: number) {
  return Array.from({ length: numberOfVersions }, (_, index) => ({
    version: `${major}.${index}.0`,
    createdAt: '2026-03-05',
    isCompatible: true,
    grafanaDependency: '>=8.0.0',
  }));
}
