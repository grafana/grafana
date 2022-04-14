import React from 'react';
import { DBClusterConnection } from './DBClusterConnection';
import { dbClustersStub, mongoDBClusterConnectionStub } from '../__mocks__/dbClustersStubs';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('app/core/app_events');
jest.mock('../XtraDB.service');
jest.mock('../PSMDB.service');

jest.mock('@percona/platform-core', () => {
  const originalModule = jest.requireActual('@percona/platform-core');
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
});
