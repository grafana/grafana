import React from 'react';
import { shallow } from 'enzyme';
import { Icon } from '@grafana/ui';
import { DBClusterName } from './DBClusterName';
import { dbClustersStub } from '../__mocks__/dbClustersStubs';

describe('DBClusterName::', () => {
  it('renders correctly with name and icon', () => {
    const cluster = dbClustersStub[0];
    const root = shallow(<DBClusterName dbCluster={cluster} />);

    expect(root.text()).toContain(cluster.clusterName);
    expect(root.find(Icon)).toBeTruthy();
  });
  it('renders correctly MySQL cluster URL', () => {
    const cluster = dbClustersStub[0];
    const root = shallow(<DBClusterName dbCluster={cluster} />);

    expect(root.find('a').prop('href')).toContain('pxc');
    expect(root.find('a').prop('href')).toContain(cluster.clusterName);
  });
  it('renders correctly MongoDB cluster URL', () => {
    const cluster = dbClustersStub[2];
    const root = shallow(<DBClusterName dbCluster={cluster} />);

    expect(root.find('a').prop('href')).toContain('mongodb');
    expect(root.find('a').prop('href')).toContain(cluster.clusterName);
  });
});
