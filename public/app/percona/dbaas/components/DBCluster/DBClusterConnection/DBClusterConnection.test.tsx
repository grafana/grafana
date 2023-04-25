import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { dbClustersStub, mongoDBClusterConnectionStub } from '../__mocks__/dbClustersStubs';

import { DBClusterConnection } from './DBClusterConnection';

jest.mock('app/core/app_events');
jest.mock('../XtraDB.service');
jest.mock('../PSMDB.service');

jest.mock('app/percona/shared/helpers/logger', () => {
  const originalModule = jest.requireActual('app/percona/shared/helpers/logger');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});

describe('DBClusterConnection::', () => {
  it('renders correctly connection items', async () => {
    await waitFor(() => render(<DBClusterConnection dbCluster={dbClustersStub[0]} />));

    expect(screen.getByTestId('cluster-connection-host')).toBeInTheDocument();
    expect(screen.getByTestId('cluster-connection-port')).toBeInTheDocument();
    expect(screen.getByTestId('cluster-connection-username')).toBeInTheDocument();
    expect(screen.getByTestId('cluster-connection-password')).toBeInTheDocument();
  });
  it('renders correctly connection items with MongoDB cluster', async () => {
    await waitFor(() => render(<DBClusterConnection dbCluster={dbClustersStub[2]} />));

    expect(screen.getByTestId('cluster-connection-host')).toBeInTheDocument();
    expect(screen.getByTestId('cluster-connection-host')).toHaveTextContent(mongoDBClusterConnectionStub.host);
    expect(screen.getByTestId('cluster-connection-port')).toBeInTheDocument();
    expect(screen.getByTestId('cluster-connection-username')).toBeInTheDocument();
    expect(screen.getByTestId('cluster-connection-password')).toBeInTheDocument();
  });
  it('does not show loading when the DBcluster paused', async () => {
    await waitFor(() => render(<DBClusterConnection dbCluster={dbClustersStub[5]} />));
    expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
  });
  it('show loading when the DBcluster status = upgrading', async () => {
    await waitFor(() => render(<DBClusterConnection dbCluster={dbClustersStub[6]} />));
    expect(screen.getByTestId('Spinner')).toBeInTheDocument();
  });
  it('show loading when the DBcluster status = changing', async () => {
    await waitFor(() => render(<DBClusterConnection dbCluster={dbClustersStub[7]} />));
    expect(screen.getByTestId('Spinner')).toBeInTheDocument();
  });
  it('show loading when the DBcluster status = deleting', async () => {
    await waitFor(() => render(<DBClusterConnection dbCluster={dbClustersStub[8]} />));
    expect(screen.getByTestId('Spinner')).toBeInTheDocument();
  });
});
