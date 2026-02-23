import { render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';

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

    renderWithStore(<VersionList pluginId={''} versions={versions} disableInstallation={false} />);
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

    renderWithStore(
      <VersionList
        pluginId={''}
        versions={versions}
        installedVersion={versions[installedVersionIndex].version}
        disableInstallation={false}
      />
    );
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

    renderWithStore(
      <VersionList pluginId={''} versions={versions} installedVersion={installedVersion} disableInstallation={false} />
    );

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

    renderWithStore(
      <VersionList pluginId={''} versions={versions} installedVersion={installedVersion} disableInstallation={false} />
    );

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
});

function renderWithStore(component: JSX.Element) {
  const store = configureStore();

  return render(<Provider store={store}>{component}</Provider>);
}
