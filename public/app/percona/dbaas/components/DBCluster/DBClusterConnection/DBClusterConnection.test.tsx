import React from 'react';
import { DBClusterConnection } from './DBClusterConnection';
import { dbClustersStub, mongoDBClusterConnectionStub } from '../__mocks__/dbClustersStubs';
import { getMount } from 'app/percona/shared/helpers/testUtils';

jest.mock('app/core/app_events');
jest.mock('../XtraDB.service');
jest.mock('../PSMDB.service');

describe('DBClusterConnection::', () => {
  it('renders correctly connection items', async () => {
    const root = await getMount(<DBClusterConnection dbCluster={dbClustersStub[0]} />);

    expect(root.find('[data-qa="cluster-connection-host"]')).toBeTruthy();
    expect(root.find('[data-qa="cluster-connection-port"]')).toBeTruthy();
    expect(root.find('[data-qa="cluster-connection-username"]')).toBeTruthy();
    expect(root.find('[data-qa="cluster-connection-password"]')).toBeTruthy();
  });
  it('renders correctly connection items with MongoDB cluster', async () => {
    const root = await getMount(<DBClusterConnection dbCluster={dbClustersStub[2]} />);

    root.update();

    const host = root.find('[data-qa="cluster-connection-host"]');

    expect(host).toBeTruthy();
    expect(host.text()).toContain(mongoDBClusterConnectionStub.host);
    expect(root.find('[data-qa="cluster-connection-port"]')).toBeTruthy();
    expect(root.find('[data-qa="cluster-connection-username"]')).toBeTruthy();
    expect(root.find('[data-qa="cluster-connection-password"]')).toBeTruthy();
  });
});
