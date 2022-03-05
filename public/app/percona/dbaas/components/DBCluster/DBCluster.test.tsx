import React from 'react';
import { DATABASE_LABELS } from 'app/percona/shared/core';
import { DBCluster } from './DBCluster';
import { kubernetesStub } from '../Kubernetes/__mocks__/kubernetesStubs';
import { dbClustersStub } from './__mocks__/dbClustersStubs';
import { formatDBClusterVersion } from './DBCluster.utils';
import { render, screen } from '@testing-library/react';
import { useSelector } from 'react-redux';

jest.mock('app/core/app_events');
jest.mock('./DBCluster.hooks');
jest.mock('app/percona/settings/Settings.service');

jest.mock('@percona/platform-core', () => {
  const originalModule = jest.requireActual('@percona/platform-core');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});

jest.mock('react-redux', () => {
  const original = jest.requireActual('react-redux');
  return {
    ...original,
    useSelector: jest.fn(),
  };
});

describe('DBCluster::', () => {
  beforeEach(() => {
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({ perconaUser: { isAuthorized: true }, perconaSettings: { isLoading: false } });
    });
  });

  it('renders correctly without clusters', async () => {
    render(<DBCluster kubernetes={[]} />);
    expect(await screen.getAllByTestId('dbcluster-add-cluster-button')).toHaveLength(2);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders correctly with clusters', async () => {
    render(<DBCluster kubernetes={kubernetesStub} />);

    expect(await screen.getAllByTestId('dbcluster-add-cluster-button')).toHaveLength(1);
    expect(screen.getAllByRole('row')).toHaveLength(6);
  });

  it('renders correctly with failed status', async () => {
    render(<DBCluster kubernetes={kubernetesStub} />);

    expect(await screen.getAllByTestId('cluster-progress-bar').length).toBeGreaterThan(0);
    expect(await screen.getAllByTestId('cluster-status-error-message').length).toBeGreaterThan(0);
  });

  it('renders database types correctly', async () => {
    render(<DBCluster kubernetes={kubernetesStub} />);

    expect(screen.getAllByRole('cell')[1].textContent).toEqual(
      `${DATABASE_LABELS[dbClustersStub[0].databaseType]} ${formatDBClusterVersion(dbClustersStub[0].installedImage)}`
    );
    expect(screen.getAllByRole('cell')[7].textContent).toEqual(
      `${DATABASE_LABELS[dbClustersStub[1].databaseType]} ${formatDBClusterVersion(dbClustersStub[1].installedImage)}`
    );
    expect(screen.getAllByRole('cell')[13].textContent).toEqual(
      `${DATABASE_LABELS[dbClustersStub[2].databaseType]} ${formatDBClusterVersion(dbClustersStub[2].installedImage)}`
    );
  });
});
