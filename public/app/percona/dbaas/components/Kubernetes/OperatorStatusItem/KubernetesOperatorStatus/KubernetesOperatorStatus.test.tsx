import React from 'react';
import { shallow } from 'enzyme';
import { Databases } from 'app/percona/shared/core';
import { dataQa } from '@percona/platform-core';
import { KubernetesOperatorStatus as Status } from './KubernetesOperatorStatus.types';
import { KubernetesOperatorStatus } from './KubernetesOperatorStatus';
import { kubernetesStub } from '../../__mocks__/kubernetesStubs';

describe('KubernetesOperatorStatus::', () => {
  it('renders installation link when unavailable', () => {
    const root = shallow(
      <KubernetesOperatorStatus
        operator={{ status: Status.unavailable }}
        databaseType={Databases.mongodb}
        kubernetes={kubernetesStub[0]}
        setSelectedCluster={jest.fn()}
        setOperatorToUpdate={jest.fn()}
        setUpdateOperatorModalVisible={jest.fn()}
      />
    );

    expect(root.find(dataQa('cluster-link'))).toBeTruthy();
  });

  it("doesn't render link when installed", () => {
    const root = shallow(
      <KubernetesOperatorStatus
        operator={{ status: Status.ok }}
        databaseType={Databases.mongodb}
        kubernetes={kubernetesStub[0]}
        setSelectedCluster={jest.fn()}
        setOperatorToUpdate={jest.fn()}
        setUpdateOperatorModalVisible={jest.fn()}
      />
    );

    expect(root.contains(dataQa('cluster-link'))).toBeFalsy();
  });

  it('renders link when available new version is available', () => {
    const root = shallow(
      <KubernetesOperatorStatus
        operator={{ status: Status.ok, availableVersion: '1.4.3' }}
        databaseType={Databases.mongodb}
        kubernetes={kubernetesStub[0]}
        setSelectedCluster={jest.fn()}
        setOperatorToUpdate={jest.fn()}
        setUpdateOperatorModalVisible={jest.fn()}
      />
    );

    expect(root.find(dataQa('cluster-link'))).toBeTruthy();
  });
});
