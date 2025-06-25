import { render, screen } from '@testing-library/react';
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
});

function renderWithStore(component: JSX.Element) {
  const store = configureStore();

  return render(<Provider store={store}>{component}</Provider>);
}
